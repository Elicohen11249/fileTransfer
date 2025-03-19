const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const XLSX = require('xlsx');

let mainWindow;

// Get Command-Line Arguments (For `.exe` Execution)
const args = process.argv.slice(1);
const ipAddress = args[0];   // First argument = IP Address
let newFileName = args[1] || '';   // Second argument (Optional) = New filename
console.log('eeeeeeeeee', ipAddress, newFileName);



app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 600,
        height: 400,
        icon: path.join(__dirname, 'transfer.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.menuBarVisible = false;
    mainWindow.loadFile('index.html');
});

// File Selection Dialog
ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: "Select an Excel File to Move",
        properties: ['openFile'],
        filters: [
            { name: 'Accepted Files', extensions: ['xlsx', 'xls', 'txt', 'tsv', 'csv'] },
            { name: 'all files', extensions: ['*'] }

        ]
    });
    // If no file was selected, show an error and return null
    if (!result.filePaths.length) {
        dialog.showErrorBox('No file selected', 'Please select a valid Excel or text file.');
        return null; // Ensure the function stops execution
    }

    const selectedFile = result.filePaths[0]; // Get the selected file
 
    const fileExt = path.extname(selectedFile).toLowerCase(); // Get file extension

    

    const sheetNames =  checkFileSheets(selectedFile);

     

    if (sheetNames.length === 1 && newFileName) {
        mainWindow.webContents.send('show-new-filename', newFileName);

    }

 
    return { selectedFile, sheetNames, newFileName,fileExt }; // Return the selected file path

});


//Handle File Transfer
ipcMain.handle('move-file', async (event, filePath, selectedSheet, newFileName) => {
  

    let originalExt = path.extname(filePath);
    let fileDir = path.dirname(filePath);
    let newExt = path.extname(newFileName);


    let filePath2 = filePath
    let newFilePath = path.join(fileDir, newFileName);
     // Convert Excel files if extension changes
    if (originalExt === '.xlsx' || originalExt === '.xls') {
        // Convert and overwrite the existing file
        filePath2 = convertExtension(filePath, newExt, selectedSheet); // Returns the new file path
     }
 
    if (newFileName !== path.basename(filePath)) {
        // Rename File
        newFilePath = path.join(fileDir, newFileName);


        if (isFileLocked(filePath2)) {
            throw new Error('File is locked by another program (Excel, Notepad, etc.). Please close it and try again.');
        }

        try {
            fs.renameSync(filePath2, newFilePath);
         } catch (err) {
            console.error('File rename failed:', err);
        
            if (err.code === 'EBUSY' || err.code === 'EPERM') {
                dialog.showErrorBox(
                    'File in Use',
                    'The file is currently open in another program. Please close it and try again.'
                );
            } else {
                dialog.showErrorBox('File Rename Error', `Could not rename the file: ${err.message}`);
            }
        
            throw err;  // Ensure the process does not continue with an incorrect filename
        }
      }


    //Transfer File to Unix Server
    let destination = `/usr/lib/basic/${newFileName}`;
    //const command = `"${process.env.WINDIR}\\datapipe.exe" "${ipAddress}" "${newFilePath.replace(/"/g, '\\"')}" "${destination.replace(/"/g, '\\"')}" "/usr/lib/basic/mvfile ${newFileName.replace(/"/g, '\\"')}"`;


    const command = `"${process.env.WINDIR}\\datapipe.exe" "${ipAddress}" "${newFilePath}" "${destination}" "/usr/lib/basic/mvfile ${newFileName}" `;
 
    // Execute the command
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Exec error: ${error}`);
            return;
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return;
        }
 
        // Show the message box once the command execution is complete
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'File Transferred',
            message: 'File has been transferred successfully.',
            buttons: ['OK']
        }).then(() => {
            // Close the app once the message box is dismissed
            console.log('Closing app...');
            app.quit();
        }).catch(err => {
            console.error('Error showing dialog:', err);
            app.quit(); // Ensure the app quits even if there's an error
        });
    });


});

function checkFileSheets(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    return sheetNames;
}

function convertExtension(filePath, newExt, selectedSheet) {
     const workbook = XLSX.readFile(filePath);
    let sheet;
   
    if (selectedSheet) {
        sheet = workbook.Sheets[selectedSheet];
     } else {
        sheet = workbook.SheetNames[0];
 
    }
     let convertedData;
    if (newExt === '.tsv' || newExt === '.txt') {
        convertedData = XLSX.utils.sheet_to_csv(sheet, { FS: "\t" }); // Convert to TSV format
     } else if (newExt === '.csv') {
        convertedData = XLSX.utils.sheet_to_csv(sheet); // Convert to CSV
    } else {
        console.error('Unsupported output format.');
        return filePath; // Return the original file path if not converted
    }

    // Ensure the file is saved with the correct extension
    const fileDir = path.dirname(filePath);
    const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
    const newFilePath = path.join(fileDir, fileNameWithoutExt + newExt);
     // Overwrite the existing file
     fs.writeFileSync(newFilePath, convertedData, 'utf8');
    return newFilePath; // Return the new file path
}

const isFileLocked = (filePath) => {
    try {
        const fd = fs.openSync(filePath, 'r+'); // Try to open in read-write mode
        fs.closeSync(fd);
        return false; // File is not locked
    } catch (err) {
        return true; // File is locked
    }
};