import { GoogleSignin } from '@react-native-google-signin/google-signin';
import RNFS from 'react-native-fs';

class GoogleDriveService {
  constructor() {
    // Initialize Google Sign-In
    GoogleSignin.configure({
      webClientId:
        '389876117832-fek2k89rjletuicspt3vp07m2ekagidj.apps.googleusercontent.com',
      offlineAccess: true,
      forceCodeForRefreshToken: true,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
  }

  async signIn() {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      return userInfo;
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      throw error;
    }
  }

  async isSignedIn() {
    return await GoogleSignin.isSignedIn();
  }

  async getCurrentUser() {
    return await GoogleSignin.getCurrentUser();
  }

  async signOut() {
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  async uploadToGoogleDrive(fileUri, mimeType = 'image/webp', fileName = null) {
    try {
      // Check if user is signed in
      const isUserSignedIn = await this.isSignedIn();
      if (!isUserSignedIn) {
        await this.signIn();
      }

      // Get tokens
      const tokens = await GoogleSignin.getTokens();
      if (!tokens || !tokens.accessToken) {
        throw new Error('Failed to get access token');
      }

      // Get file stats
      const fileStats = await RNFS.stat(fileUri);

      // Generate a file name if not provided
      if (!fileName) {
        fileName = `EV_Charger_Map_${new Date().toISOString()}.webp`;
      }

      // Create multipart form data
      const boundary =
        '-------FormBoundary' + Math.random().toString(36).substring(2);

      // Google Drive API metadata
      const metadata = JSON.stringify({
        name: fileName,
        mimeType: mimeType,
      });

      // Read file as base64
      const fileContent = await RNFS.readFile(fileUri, 'base64');

      // Build multipart request body
      let body = '';

      // Metadata part
      body += `--${boundary}\r\n`;
      body += 'Content-Type: application/json; charset=UTF-8\r\n\r\n';
      body += metadata + '\r\n';

      // File content part
      body += `--${boundary}\r\n`;
      body += `Content-Type: ${mimeType}\r\n`;
      body += 'Content-Transfer-Encoding: base64\r\n\r\n';
      body += fileContent + '\r\n';

      // End boundary
      body += `--${boundary}--`;

      // Upload to Google Drive API
      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: body,
        },
      );

      const responseData = await response.json();

      if (response.ok) {
        console.log('File uploaded successfully:', responseData);
        return {
          success: true,
          fileId: responseData.id,
          fileName: responseData.name,
        };
      } else {
        console.error('Upload failed:', responseData);
        throw new Error(responseData.error?.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading to Google Drive:', error);
      throw error;
    }
  }
}

export default new GoogleDriveService();
