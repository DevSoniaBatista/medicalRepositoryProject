const form = document.getElementById("metadata-form");
const resultsSection = document.getElementById("results");
const metadataOutput = document.getElementById("metadata-json");
const encryptedOutput = document.getElementById("encrypted-payload");
const keyOutput = document.getElementById("sym-key");
const uploadStatus = document.getElementById("upload-status");
const filesField = document.getElementById("files");

const toastTemplate = document.getElementById("toast-template");

let latestPayload = null;
let isUploading = false;

prefillFilesFromStorage();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const metadata = buildMetadata(event.target);
    const metadataJson = JSON.stringify(metadata, null, 2);

    const { payload, keyHex } = await encryptMetadata(metadataJson);

    metadataOutput.textContent = metadataJson;
    encryptedOutput.textContent = JSON.stringify(payload, null, 2);
    keyOutput.textContent = keyHex;
    latestPayload = payload;
    resetUploadStatus();

    resultsSection.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    alert("Erro ao cifrar metadata. Verifique o console para detalhes.");
  }
});

document.querySelectorAll("button[data-upload]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!latestPayload) {
      alert("Gere o payload cifrado antes de enviar.");
      return;
    }

    if (isUploading) {
      return;
    }

    try {
      await uploadEncryptedPayload(latestPayload);
    } catch (error) {
      console.error("Upload error", error);
    }
  });
});

document.querySelectorAll("button[data-copy]").forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.copy;
    const text = document.getElementById(targetId)?.textContent ?? "";
    if (text.trim().length === 0) return;
    navigator.clipboard
      .writeText(text)
      .then(() => showToast("Copiado!"))
      .catch(() => alert("Não foi possível copiar."));
  });
});

document.querySelectorAll("button[data-download]").forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.download;
    const filename = button.dataset.filename ?? "download.json";
    const content = document.getElementById(targetId)?.textContent ?? "";
    if (content.trim().length === 0) return;

    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
});

function buildMetadata(form) {
  const formData = new FormData(form);
  const filesRaw = formData.get("files")?.toString() ?? "";

  const files = filesRaw
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    schema: "medical-record-metadata@1",
    createdAt: new Date().toISOString(),
    patientHash: formData.get("patientHash"),
    examType: formData.get("examType"),
    date: formData.get("examDate"),
    files,
    notesHash: formData.get("notesHash") || null,
  };
}

async function encryptMetadata(metadataJson) {
  const encoder = new TextEncoder();
  const metadataBytes = encoder.encode(metadataJson);

  // Gera chave AES-256
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );

  // Exporta chave em hex
  const keyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  const keyHex = bufferToHex(keyRaw);

  // Gera IV de 12 bytes
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    metadataBytes
  );

  const cipherWithTag = new Uint8Array(encryptedBuffer);
  const authTagLength = 16;
  const tag = cipherWithTag.slice(cipherWithTag.length - authTagLength);
  const cipher = cipherWithTag.slice(0, cipherWithTag.length - authTagLength);

  const payload = {
    schema: "medical-record-payload@1",
    timestamp: Math.floor(Date.now() / 1000),
    iv: bufferToBase64(iv),
    encrypted: bufferToBase64(cipher),
    authTag: bufferToBase64(tag),
  };

  return {
    payload,
    keyHex,
  };
}

function bufferToHex(buffer) {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bufferToBase64(buffer) {
  const binary = String.fromCharCode(...buffer);
  return btoa(binary);
}

function showToast(message) {
  const toast = toastTemplate.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}

function setUploadStatus(message, variant = "info") {
  if (!uploadStatus) return;
  uploadStatus.textContent = message;
  uploadStatus.classList.remove("hidden", "success", "error");
  if (variant === "success") {
    uploadStatus.classList.add("success");
  } else if (variant === "error") {
    uploadStatus.classList.add("error");
  }
}

function resetUploadStatus() {
  if (!uploadStatus) return;
  uploadStatus.textContent = "";
  uploadStatus.classList.add("hidden");
  uploadStatus.classList.remove("success", "error");
}

function prefillFilesFromStorage() {
  if (!filesField) return;
  const stored = localStorage.getItem("uploadedCids");
  if (!stored) return;

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const existing = filesField.value ? filesField.value.trim().split(/\r?\n|,/) : [];
      const merged = [...new Set([...existing.filter(Boolean), ...parsed])];
      filesField.value = merged.join("\n");
      showToast("CIDs adicionados do upload de arquivos.");
    }
  } catch (error) {
    console.error("Falha ao ler uploadedCids do storage", error);
  } finally {
    localStorage.removeItem("uploadedCids");
  }
}

async function uploadEncryptedPayload(payload) {
  try {
    isUploading = true;
    setUploadStatus("Enviando payload cifrado ao Pinata...", "info");

    const response = await fetch("http://127.0.0.1:3000/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error || "Falha no upload";
      const detail = data?.detail ? ` Detalhe: ${JSON.stringify(data.detail)}` : "";
      setUploadStatus(`${message}.${detail}`, "error");
      throw new Error(`${message}${detail}`);
    }

    const { cid, metaHash } = data;
    const successMessage = metaHash
      ? `Upload concluído! CID: ${cid} | metaHash: ${metaHash}`
      : `Upload concluído! CID: ${cid}`;
    setUploadStatus(successMessage, "success");
    showToast("Upload realizado!");
  } catch (error) {
    console.error("Falha ao enviar payload", error);
    if (!uploadStatus?.classList.contains("error")) {
      setUploadStatus("Erro ao enviar payload. Verifique o backend.", "error");
    }
    alert("Não foi possível enviar o payload. Veja o console/backend para mais detalhes.");
    throw error;
  } finally {
    isUploading = false;
  }
}

