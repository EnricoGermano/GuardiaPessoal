import * as LocalAuthentication from 'expo-local-authentication';

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function getBiometricTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
  return LocalAuthentication.supportedAuthenticationTypesAsync();
}

export async function authenticateWithBiometrics(
  promptMessage = 'Autentique-se para continuar'
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancelar',
      disableDeviceFallback: true,
      fallbackLabel: '',
    });

    return {
      success: result.success,
      error: result.success ? undefined : (result.error || 'Falha na autenticacao'),
    };
  } catch (err) {
    return {
      success: false,
      error: 'Erro ao acessar biometria',
    };
  }
}
