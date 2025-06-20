import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

class GoogleDriveService {
  constructor() {
    this.configureGoogleSignIn();
  }

  configureGoogleSignIn() {
    try {
      GoogleSignin.configure({
        // CRITICAL: Replace with your ACTUAL Web Client ID from Google Cloud Console
        // This should be the Web Client ID, NOT Android/iOS Client ID
        webClientId: 'YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com',

        // Add Android Client ID if you have one
        androidClientId:
          Platform.OS === 'android'
            ? 'YOUR_ANDROID_CLIENT_ID_HERE.apps.googleusercontent.com'
            : undefined,

        // Add iOS Client ID if you have one
        iosClientId:
          Platform.OS === 'ios'
            ? 'YOUR_IOS_CLIENT_ID_HERE.apps.googleusercontent.com'
            : undefined,

        // Essential scopes for Google Drive
        scopes: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
        ],

        // Important configuration options
        offlineAccess: true,
        forceCodeForRefreshToken: true,

        // Add these for better reliability
        hostedDomain: '', // Leave empty unless you need domain restriction
        loginHint: '', // Leave empty
        includeServerAuthCode: false, // Set to true if you need server auth code
      });

      console.log('GoogleSignin configured successfully');
    } catch (error) {
      console.error('Failed to configure GoogleSignin:', error);
    }
  }

  async signIn() {
    try {
      console.log('Starting Google Sign-In process...');

      // Clear any existing sign-in state first
      await this.signOut();

      // Check Google Play Services availability (Android only)
      if (Platform.OS === 'android') {
        try {
          await GoogleSignin.hasPlayServices({
            showPlayServicesUpdateDialog: true,
          });
          console.log('Google Play Services available');
        } catch (playServicesError) {
          console.error('Google Play Services error:', playServicesError);
          throw new Error(
            'Google Play Services are not available or need to be updated. Please update Google Play Services and try again.',
          );
        }
      }

      // Attempt sign-in
      console.log('Attempting Google Sign-In...');
      const userInfo = await GoogleSignin.signIn();

      if (!userInfo) {
        throw new Error('Sign-in completed but no user information received');
      }

      console.log(
        'Sign-in successful for:',
        userInfo.user?.email || 'Unknown user',
      );

      // Verify we have access tokens
      const tokens = await GoogleSignin.getTokens();
      if (!tokens?.accessToken) {
        throw new Error('Sign-in successful but no access token received');
      }

      console.log('Access token obtained successfully');
      return userInfo;
    } catch (error) {
      console.error('Google Sign-In Error Details:', {
        code: error.code,
        message: error.message,
        toString: error.toString(),
      });

      // Handle specific error codes
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
          // Check for common configuration issues
          if (
            error.message?.includes('DEVELOPER_ERROR') ||
            error.message?.includes('Invalid application')
          ) {
            throw new Error(
              'Google Sign-In configuration error. Please check:\n' +
                '1. Web Client ID is correct\n' +
                '2. SHA-1 certificate is added to Firebase/Google Cloud Console\n' +
                '3. Google Sign-In API is enabled',
            );
          }

          if (
            error.message?.includes('network') ||
            error.message?.includes('Network')
          ) {
            throw new Error(
              'Network error. Please check your internet connection',
            );
          }

          // Generic error with helpful message
          throw new Error(
            `Sign-in failed: ${error.message || 'Unknown error'}. ` +
              'Please check your Google Sign-In configuration.',
          );
      }
    }
  }

  async isSignedIn() {
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      console.log('Sign-in status:', isSignedIn);
      return isSignedIn;
    } catch (error) {
      console.error('Error checking sign-in status:', error);
      return false;
    }
  }

  async getCurrentUser() {
    try {
      const currentUser = await GoogleSignin.getCurrentUser();
      console.log('Current user:', currentUser?.user?.email || 'None');
      return currentUser;
    } catch (error) {
      console.error('Error getting current user:', error);
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
    } catch (error) {
      console.error('Sign out error:', error);
      // Don't throw error for sign out - just log it
      return false;
    }
  }

  async getValidTokens() {
    try {
      // Check if user is signed in
      const isSignedIn = await this.isSignedIn();
      if (!isSignedIn) {
        throw new Error('User not signed in');
      }

      // Try to get current tokens
      let tokens = await GoogleSignin.getTokens();

      if (!tokens?.accessToken) {
        console.log('No access token, attempting to refresh...');
        // Try to refresh by getting current user (this can refresh tokens)
        await GoogleSignin.getCurrentUser();
        tokens = await GoogleSignin.getTokens();

        if (!tokens?.accessToken) {
          throw new Error('Unable to obtain valid access token');
        }
      }

      return tokens;
    } catch (error) {
      console.error('Error getting valid tokens:', error);
      throw error;
    }
  }

  async uploadToGoogleDrive(fileUri, mimeType = 'image/webp', fileName = null) {
    try {
      console.log('Starting Google Drive upload for:', fileUri);

      // Verify file exists
      const fileExists = await RNFS.exists(fileUri);
      if (!fileExists) {
        throw new Error(`File not found: ${fileUri}`);
      }

      // Ensure user is authenticated
      const isSignedIn = await this.isSignedIn();
      if (!isSignedIn) {
        throw new Error('User must be signed in to upload to Google Drive');
      }

      // Get valid access tokens
      const tokens = await this.getValidTokens();

      // Generate filename if not provided
      if (!fileName) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        fileName = `EV_Charger_Map_${timestamp}.webp`;
      }

      console.log('Uploading file:', fileName);

      // Read file content
      const fileContent = await RNFS.readFile(fileUri, 'base64');
      console.log(`File read successfully (${fileContent.length} characters)`);

      // Create multipart form data
      const boundary = `----FormBoundary${Math.random()
        .toString(36)
        .substring(2)}`;

      const metadata = JSON.stringify({
        name: fileName,
        mimeType: mimeType,
      });

      let body = '';
      body += `--${boundary}\r\n`;
      body += 'Content-Type: application/json; charset=UTF-8\r\n\r\n';
      body += metadata + '\r\n';
      body += `--${boundary}\r\n`;
      body += `Content-Type: ${mimeType}\r\n`;
      body += 'Content-Transfer-Encoding: base64\r\n\r\n';
      body += fileContent + '\r\n';
      body += `--${boundary}--`;

      // Upload to Google Drive
      console.log('Sending request to Google Drive API...');
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
      console.log('Google Drive API response:', responseData);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please sign in again.');
        } else if (response.status === 403) {
          throw new Error('Access denied. Check Google Drive API permissions.');
        } else if (responseData.error) {
          throw new Error(`Upload failed: ${responseData.error.message}`);
        } else {
          throw new Error(`Upload failed with status: ${response.status}`);
        }
      }

      console.log('File uploaded successfully to Google Drive');
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
