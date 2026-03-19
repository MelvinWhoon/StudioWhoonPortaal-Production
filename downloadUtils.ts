
export const downloadFile = (base64Data: string, fileName: string) => {
  if (!base64Data) return;
  
  let href = base64Data;
  
  // If it's a raw base64 string (doesn't start with data:), prepend the prefix
  if (!base64Data.startsWith('data:')) {
    // We use application/octet-stream as a safe default for raw binary data
    href = `data:application/octet-stream;base64,${base64Data}`;
  }
  
  // Create a temporary link element
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  
  // Append to the body, click it, and remove it
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToCsv = (data: any[], filename: string) => {
  if (!data || !data.length) return;

  const separator = ',';
  const keys = Object.keys(data[0]);
  
  const csvContent = [
    keys.join(separator),
    ...data.map(row => {
      return keys.map(k => {
        let cell = row[k] === null || row[k] === undefined ? '' : row[k];
        cell = cell instanceof Date ? cell.toLocaleString() : cell.toString().replace(/"/g, '""');
        if (cell.search(/("|,|\n)/g) >= 0) {
          cell = `"${cell}"`;
        }
        return cell;
      }).join(separator);
    })
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
