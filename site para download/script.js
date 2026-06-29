const RELEASE = {
  version: '1.7.0',
  fileName: 'HavenFall-Desktop-portable.exe',
  relativePath: 'downloads/HavenFall-Desktop-portable.exe'
};

const versionLabel = document.getElementById('versionLabel');
const fileNameLabel = document.getElementById('fileNameLabel');
const downloadButton = document.getElementById('downloadButton');

if (versionLabel) versionLabel.textContent = RELEASE.version;
if (fileNameLabel) fileNameLabel.textContent = RELEASE.fileName;

if (downloadButton) {
  downloadButton.href = RELEASE.relativePath;
  downloadButton.setAttribute('download', RELEASE.fileName);
  downloadButton.addEventListener('click', () => {
    downloadButton.textContent = 'Baixando...';
    setTimeout(() => {
      downloadButton.textContent = 'Baixar jogo';
    }, 1800);
  });
}
