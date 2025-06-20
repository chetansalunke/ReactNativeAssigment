import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import RNFS from 'react-native-fs';

class GoogleDriveService {
  constructor() {
    this.configureGoogleSignIn();
  }

  configureGoogleSignIn() {
    try {
      GoogleSignin.configure({
        // ONLY use your Web Client ID here
        webClientId:
          '389876117832-fek2k89rjletuicspt3vp07m2ekagidj.apps.googleusercontent.com',
        scopes: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
        ],
        offlineAccess: true,
        forceCodeForRefreshToken: true,
      });
      console.log('GoogleSignin configured successfully');
    } catch (error) {
      console.error('Failed to configure GoogleSignin:', error);
    }
  }

  async signIn() {
    try {
      console.log('Starting Google Sign-In process...');
      await this.signOut();

      const userInfo = await GoogleSignin.signIn();
      if (!userInfo)
        throw new Error('Sign-in completed but no user information received');

      const tokens = await GoogleSignin.getTokens();
      if (!tokens?.accessToken)
        throw new Error('Sign-in successful but no access token received');

      console.log(
        'Sign-in successful for:',
        userInfo.user?.email || 'Unknown user',
      );
      return userInfo;
    } catch (error) {
      console.error('Google Sign-In Error Details:', {
        code: error.code,
        message: error.message,
      });
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw new Error('Sign-in was cancelled by user');
        case statusCodes.IN_PROGRESS:
          throw new Error('Sign-in already in progress');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new Error('Google Play Services not available or outdated');
        case statusCodes.SIGN_IN_REQUIRED:
          throw new Error('User must sign in first');
        default:
          throw new Error(error.message || 'Google Sign-In failed');
      }
    }
  }

  async isSignedIn() {
    try {
      return await GoogleSignin.isSignedIn();
    } catch {
      return false;
    }
  }

  async getCurrentUser() {
    try {
      return await GoogleSignin.getCurrentUser();
    } catch {
      return null;
    }
  }

  async signOut() {
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) {
        await GoogleSignin.revokeAccess();
        await GoogleSignin.signOut();
        console.log('User signed out successfully');
      }
      return true;
    } catch {
      return false;
    }
  }

  async getValidTokens() {
    const isSignedIn = await this.isSignedIn();
    if (!isSignedIn) throw new Error('User not signed in');
    let tokens = await GoogleSignin.getTokens();
    if (!tokens?.accessToken) {
      await GoogleSignin.getCurrentUser();
      tokens = await GoogleSignin.getTokens();
      if (!tokens?.accessToken)
        throw new Error('Unable to obtain valid access token');
    }
    return tokens;
  }

  async uploadToGoogleDrive(fileUri, mimeType = 'image/webp', fileName = null) {
    try {
      const fileExists = await RNFS.exists(fileUri);
      if (!fileExists) throw new Error(`File not found: ${fileUri}`);

      const tokens = await this.getValidTokens();

      if (!fileName) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        fileName = `EV_Charger_Map_${timestamp}.webp`;
      }

      const fileContent = await RNFS.readFile(fileUri, 'base64');
      const boundary = `----FormBoundary${Math.random()
        .toString(36)
        .substring(2)}`;
      const metadata = JSON.stringify({ name: fileName, mimeType });

      let body = '';
      body += `--${boundary}\r\n`;
      body += 'Content-Type: application/json; charset=UTF-8\r\n\r\n';
      body += metadata + '\r\n';
      body += `--${boundary}\r\n`;
      body += `Content-Type: ${mimeType}\r\n`;
      body += 'Content-Transfer-Encoding: base64\r\n\r\n';
      body += fileContent + '\r\n';
      body += `--${boundary}--`;

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
      if (!response.ok) {
        throw new Error(
          responseData.error?.message || `Upload failed: ${response.status}`,
        );
      }

      return {
        success: true,
        fileId: responseData.id,
        fileName: responseData.name,
        webViewLink: `https://drive.google.com/file/d/${responseData.id}/view`,
      };
    } catch (error) {
      console.error('Google Drive upload error:', error);
      throw error;
    }
  }
}

export default new GoogleDriveService();
