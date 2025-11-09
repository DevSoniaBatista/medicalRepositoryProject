const form = document.getElementById('file-upload-form');
const fileInput = document.getElementById('examFiles');
const resultsSection = document.getElementById('upload-results');
const resultsList = document.getElementById('results-list');
const copyButton = document.getElementById('copy-cids');
const sendToFormButton = document.getElementById('send-to-form');
const feedback = document.getElementById('upload-feedback');
const toastTemplate = document.getElementById('toast-template');
const disconnectBtnTop = document.getElementById('disconnect-wallet-top');

let isUploading = false;
let uploadedItems = [];

// Função para desconectar
function handleDisconnect() {
  console.log('Desconectando carteira...');
  // Chave mestra agora é global do .env, não precisa preservar
  localStorage.clear();
  window.location.href = 'index.html?disconnected=true';
}

// Handler de desconectar
if (disconnectBtnTop) {
  disconnectBtnTop.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDisconnect();
  });
  disconnectBtnTop.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDisconnect();
  };
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const files = Array.from(fileInput.files || []);
  if (files.length === 0) {
    alert('Selecione pelo menos um arquivo.');
    return;
  }

  if (isUploading) return;

  resetFeedback();
  uploadedItems = [];
  resultsList.innerHTML = '';
  resultsSection.classList.remove('hidden');

  try {
    isUploading = true;
    setFeedback('Enviando arquivos ao Pinata...', 'info');

    for (const file of files) {
      await uploadSingleFile(file);
    }

    if (uploadedItems.length > 0) {
      setFeedback(`Uploads concluídos (${uploadedItems.length}).`, 'success');
      renderResults(uploadedItems);
      showToast('Uploads realizados!');
    }
  } catch (error) {
    console.error('Falha no upload de arquivos', error);
    if (!feedback.classList.contains('error')) {
      setFeedback('Erro ao enviar arquivos. Verifique o backend ou as credenciais.', 'error');
    }
    alert('Não foi possível completar o upload. Veja o console para mais detalhes.');
  } finally {
    isUploading = false;
  }
});

copyButton.addEventListener('click', () => {
  if (uploadedItems.length === 0) return;
  const cids = uploadedItems.map((item) => item.cid).join('\n');
  navigator.clipboard
    .writeText(cids)
    .then(() => showToast('CIDs copiados!'))
    .catch(() => alert('Não foi possível copiar os CIDs.'));
});

sendToFormButton.addEventListener('click', () => {
  if (uploadedItems.length === 0) {
    alert('Nenhum upload disponível. Envie arquivos primeiro.');
    return;
  }

  const cids = uploadedItems.map((item) => item.cid);
  localStorage.setItem('uploadedCids', JSON.stringify(cids));
  showToast('Abrindo formulário principal...');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 400);
});

function renderResults(items) {
  resultsList.innerHTML = '';

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('h3');
    title.textContent = item.fileName;

    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(
      {
        cid: item.cid,
        sha256: item.sha256,
        pinSize: item.pinSize,
        timestamp: item.timestamp
      },
      null,
      2
    );

    const cardActions = document.createElement('div');
    cardActions.className = 'card-actions';

    const copyCidButton = document.createElement('button');
    copyCidButton.className = 'secondary';
    copyCidButton.textContent = 'Copiar CID';
    copyCidButton.addEventListener('click', () => {
      navigator.clipboard
        .writeText(item.cid)
        .then(() => showToast('CID copiado!'))
        .catch(() => alert('Não foi possível copiar o CID.'));
    });

    const copyHashButton = document.createElement('button');
    copyHashButton.textContent = 'Copiar SHA-256';
    copyHashButton.addEventListener('click', () => {
      navigator.clipboard
        .writeText(item.sha256)
        .then(() => showToast('Hash copiado!'))
        .catch(() => alert('Não foi possível copiar o hash.'));
    });

    cardActions.append(copyCidButton, copyHashButton);
    card.append(title, pre, cardActions);
    resultsList.appendChild(card);
  });
}

async function uploadSingleFile(file) {
  const payload = new FormData();
  payload.append('file', file, file.name);

  const { getBackendUrl } = await import('./blockchain.js');
  const backendUrl = getBackendUrl();
  const uploadEndpoint = backendUrl ? `${backendUrl}/upload-file` : '/api/upload-file';

  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    body: payload
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error || 'Falha ao enviar arquivo';
    const detail = data?.detail ? ` Detalhe: ${JSON.stringify(data.detail)}` : '';
    setFeedback(`${message}.${detail}`, 'error');
    throw new Error(`${message}${detail}`);
  }

  uploadedItems.push({
    fileName: data.fileName || file.name,
    cid: data.cid,
    sha256: data.sha256,
    pinSize: data.pinSize,
    timestamp: data.timestamp
  });
}

function setFeedback(message, variant = 'info') {
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.remove('hidden', 'success', 'error');
  if (variant === 'success') {
    feedback.classList.add('success');
  } else if (variant === 'error') {
    feedback.classList.add('error');
  }
}

function resetFeedback() {
  if (!feedback) return;
  feedback.textContent = '';
  feedback.classList.add('hidden');
  feedback.classList.remove('success', 'error');
}

function showToast(message) {
  const toast = toastTemplate.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}


