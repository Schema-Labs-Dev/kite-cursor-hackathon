import * as SecureStore from 'expo-secure-store';

const JWT_KEY = 'kite.jwt';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(JWT_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(JWT_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(JWT_KEY);
}
