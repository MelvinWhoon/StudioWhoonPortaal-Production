
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
