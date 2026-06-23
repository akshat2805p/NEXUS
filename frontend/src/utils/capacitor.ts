import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';

export async function initializeCapacitor() {
  try {
    // Get device info
    const deviceInfo = await Device.getInfo();
    console.log('Device Info:', deviceInfo);

    // Check network status
    const networkStatus = await Network.getStatus();
    console.log('Network Status:', networkStatus);

    // Set status bar styling
    if (deviceInfo.platform === 'ios' || deviceInfo.platform === 'android') {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#d4a574' });
    }

    // Handle app exit
    App.addListener('appStateChange', (state: any) => {
      if (!state.isActive) {
        console.log('App went to background');
        // Save state, pause media, etc.
      } else {
        console.log('App went to foreground');
        // Resume, refresh, etc.
      }
    });

    // Handle back button (Android)
    App.addListener('backButton', () => {
      if (window.location.pathname === '/') {
        App.exitApp();
      } else {
        window.history.back();
      }
    });

    // Keyboard events
    Keyboard.addListener('keyboardWillShow', () => {
      console.log('Keyboard will show');
    });

    Keyboard.addListener('keyboardWillHide', () => {
      console.log('Keyboard will hide');
    });

    console.log('✓ Capacitor initialized');
  } catch (error) {
    console.log('Running in web browser (not in native app)');
  }
}

export async function getDeviceInfo() {
  try {
    return await Device.getInfo();
  } catch {
    return null;
  }
}

export async function getNetworkStatus() {
  try {
    return await Network.getStatus();
  } catch {
    return { connected: true, connectionType: 'unknown' };
  }
}

// Listen for network changes
export function setupNetworkListener(callback: (connected: boolean) => void) {
  Network.addListener('networkStatusChange', (status: any) => {
    callback(status.connected);
  });
}
