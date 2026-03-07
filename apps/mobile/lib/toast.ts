import Toast from 'react-native-toast-message';

export const showToast = {
  success: (message: string, title?: string) => {
    Toast.show({
      type: 'success',
      text1: title || 'Success',
      text2: message,
      visibilityTime: 3000,
      autoHide: true,
      position: 'bottom',
    });
  },

  error: (message: string, title?: string) => {
    Toast.show({
      type: 'error',
      text1: title || 'Error',
      text2: message,
      visibilityTime: 4000,
      autoHide: true,
      position: 'bottom',
    });
  },

  info: (message: string, title?: string) => {
    Toast.show({
      type: 'info',
      text1: title || 'Info',
      text2: message,
      visibilityTime: 3000,
      autoHide: true,
      position: 'bottom',
    });
  },

  cardScan: (card: {
    name: string;
    setName: string;
    setCode: string;
    collectorNumber: string;
    imageSmall?: string;
    priceUsd?: string | number | null;
  }) => {
    Toast.show({
      type: 'cardScan',
      props: card,
      visibilityTime: 2000,
      autoHide: true,
      position: 'bottom',
    });
  },
};
