const { google } = require('googleapis');

// Initialize the Sheets API client
const authenticateSheets = async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'sheets-auth.json', // Path to your JSON credentials
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const client = await auth.getClient();
  const googleSheets = google.sheets({ version: 'v4', auth: client });
  const spreadsheetId = '1b_1jISIYUwusGR95X4Bg5EqG5LHJQednazkXEr2aKHs'; // Replace with your spreadsheet ID

  return { googleSheets, spreadsheetId };
};



module.exports = {
  authenticateSheets,
};