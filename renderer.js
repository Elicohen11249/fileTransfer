const { ipcRenderer } = require('electron');

// Button to select files
document.getElementById('selectFiles').addEventListener('click', async () => {
    let { selectedFile, sheetNames, newFileName, fileExt } = await ipcRenderer.invoke('select-files');
    console.log('Response', selectedFile, sheetNames, newFileName,fileExt);
    let selectedSheet;
    if (!selectedFile) return;

     
    if ((fileExt   === '.xlsx' || fileExt === '.xls'  ) && sheetNames.length > 1) {
        selectedSheet = await promptForSheet(sheetNames);
        if (newFileName) {
            showNewFilename(newFileName);
        }
    }
    
      const fileList = document.getElementById('fileList');

    let li = document.createElement("li");
    li.textContent = selectedFile;
    fileList.appendChild(li);

    if (!newFileName) {

        newFileName = await promptForFilename();
        console.log('newName', newFileName);

        showNewFilename(newFileName);

    }
    console.log('im here in  not closing', selectedSheet);
    const moveFilesButton = document.getElementById('moveFiles');
    moveFilesButton.dataset.selectedFile = selectedFile;
    moveFilesButton.dataset.selectedSheet = selectedSheet ? selectedSheet : '';
    moveFilesButton.dataset.newFileName = newFileName;
    document.getElementById('moveFiles').disabled = false;




});

document.getElementById('moveFiles').addEventListener('click', async (e) => {
    e.preventDefault();
    const moveFilesButton = document.getElementById('moveFiles');
    const filePath = moveFilesButton.dataset.selectedFile;
    const selectedSheet = moveFilesButton.dataset.selectedSheet;
    const newFileName = moveFilesButton.dataset.newFileName;

    console.log('rendering', filePath, selectedSheet, newFileName);
    if (filePath && newFileName) {
        try {
            await ipcRenderer.invoke('move-file', filePath, selectedSheet, newFileName);
        } catch (error) {
            console.error("Error moving file:", error);
            alert("Failed to move the file. Check logs for details.");
        }

    }
});
 

ipcRenderer.on('show-new-filename', (event, newFileName) => {
    const filenameDisplay = document.getElementById('filenameDisplay-file');
    filenameDisplay.textContent = `${newFileName}`;
    document.getElementById('filenameDisplay').style.display = 'block';
});



 

function promptForFilename() {

    return new Promise((resolve, reject) => {

        const filenameModal = document.getElementById('filenameModal');
        filenameModal.style.display = 'block';

        //want all input should be in lower case
        document.getElementById('fileNameInput').addEventListener('input', () => {
            document.getElementById('fileNameInput').value = document.getElementById('fileNameInput').value.toLowerCase();
        });
        //  document.getElementById('submitFilename').onclick = null; // Remove previous listener
        document.getElementById('submitFilename').onclick = (e) => {
            e.preventDefault();
            const fileNameInput = document.getElementById('fileNameInput').value.trim();

            // Check if the filename is valid and has a valid extension
            if (!fileNameInput || !fileNameInput.includes('.') || !['.txt', '.tsv', '.csv'].some(ext => fileNameInput.endsWith(ext))) {
                alert('Please enter a valid filename with a valid extension (.txt, .tsv, .csv)');
                return;
            }
            filenameModal.style.display = 'none';
            console.log('im here in  promptForFilename');

            resolve(fileNameInput)

        };
    })
};

function showNewFilename(newFileName) {
    const filenameDisplay = document.getElementById('filenameDisplay-file');
    filenameDisplay.textContent = `${newFileName}`;
    document.getElementById('filenameDisplay').style.display = 'block';
};


function promptForSheet(sheetNames) {
    return new Promise((resolve) => {
        const sheetModal = document.getElementById('sheetSelectionModal');
        const sheetSelect = document.getElementById('sheetSelect');

        // Populate the dropdown
        sheetSelect.innerHTML = sheetNames.map(name => `<option value="${name}">${name}</option>`).join('');
        sheetModal.style.display = 'block';

        document.getElementById('confirmSheet').onclick = () => {
            const selectedSheet = sheetSelect.value;
            sheetModal.style.display = 'none';
            console.log('Selected sheet:', selectedSheet);
            resolve(selectedSheet); // Resolve promise when user selects
        };
    });
}