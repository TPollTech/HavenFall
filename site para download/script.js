const RELEASE = {
  version: '1.7.0',
  fileName: 'HavenFall-Desktop-portable.exe',
  relativePath: 'downloads/HavenFall-Desktop-portable.exe'
};

function applyReleaseInfo() {
  document.title = `Baixar HavenFall Desktop ${RELEASE.version}`;

  const versionLabel = document.getElementById('versionLabel');
  if (versionLabel) versionLabel.textContent = RELEASE.version;

  const fileNameLabel = document.getElementById('fileNameLabel');
  if (fileNameLabel) fileNameLabel.textContent = RELEASE.fileName;

  const links = document.querySelectorAll('[data-download-link], a[href="downloads/HavenFall-Desktop-portable.exe"]');
  links.forEach(link => {
    link.href = RELEASE.relativePath;
    link.setAttribute('download', RELEASE.fileName);
    link.setAttribute('aria-label', `Baixar ${RELEASE.fileName}`);
  });
}

function showAccessNote() {
  const helper = document.getElementById('downloadHelper');
  if (!helper) return;

  const isLocal = location.protocol === 'file:';
  helper.innerHTML = isLocal
    ? 'Este site não usa Electron. Ele abriu direto no navegador. Para o botão funcionar, coloque o executável em <strong>site para download/downloads/</strong>.'
    : 'Este site não usa Electron. Ele é uma página comum em HTML/CSS/JS e pode ficar em qualquer hospedagem estática.';
}

function trackClickFeedback() {
  const button = document.getElementById('downloadButton');
  if (!button) return;

  button.addEventListener('click', () => {
    button.textContent = 'Iniciando download...';
    setTimeout(() => { button.textContent = 'Baixar agora'; }, 2200);
  });
}

applyReleaseInfo();
showAccessNote();
trackClickFeedback();
