import * as Location from 'expo-location';
import type { SafeZone, SecurityConfig } from '../types/auth';

export interface SafeZoneCheckResult {
  allowed: boolean;
  reason?: string;
  nearestZoneName?: string;
  distanceMeters?: number;
}

/**
 * Distancia em metros entre duas coordenadas (formula de Haversine).
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Retorna as zonas seguras configuradas (com suporte a campos legados).
 */
export function getConfiguredSafeZones(config: SecurityConfig): SafeZone[] {
  if (config.safeZones && config.safeZones.length > 0) {
    return config.safeZones;
  }
  if (
    typeof config.safeLatitude === 'number' &&
    typeof config.safeLongitude === 'number'
  ) {
    return [
      {
        id: 'legacy-zone',
        name: 'Zona Segura Principal',
        latitude: config.safeLatitude,
        longitude: config.safeLongitude,
        radiusMeters: config.safeRadiusMeters ?? 300,
        createdAt: 0,
      },
    ];
  }
  return [];
}

/**
 * Solicita permissao e obtem a posicao GPS atual do aparelho.
 */
export async function getCurrentCoordinates(): Promise<{
  latitude: number;
  longitude: number;
}> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permissao de localizacao negada.');
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error('O servico de GPS do aparelho esta desativado.');
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
  };
}

/**
 * Converte um texto de endereco em coordenadas geograficas (latitude e longitude).
 */
export async function geocodeAddress(
  address: string,
  offlineOnly = false
): Promise<{ latitude: number; longitude: number }> {
  if (offlineOnly) {
    throw new Error(
      'Modo 100% Offline ativo: a busca por endereço requer conexão com a internet. Use "Local Atual (GPS)" ou desative temporariamente o Modo 100% Offline em Privacidade, Rede e Acessibilidade.'
    );
  }

  const trimmed = address.trim();
  if (!trimmed) {
    throw new Error('Informe um endereço para buscar.');
  }

  const results = await Location.geocodeAsync(trimmed);
  if (!results || results.length === 0) {
    throw new Error(`Endereço não encontrado: "${trimmed}". Verifique se o nome da rua, número ou cidade estão corretos.`);
  }

  return {
    latitude: results[0].latitude,
    longitude: results[0].longitude,
  };
}

/**
 * Obtém o nome legível de um endereço a partir de coordenadas (opcional/complementar).
 */
export async function reverseGeocodeCoords(
  latitude: number,
  longitude: number
): Promise<string | undefined> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results && results.length > 0) {
      const item = results[0];
      const parts = [item.street, item.streetNumber, item.subregion || item.city, item.region].filter(Boolean);
      return parts.join(', ');
    }
  } catch {
    // ignora se falhar
  }
  return undefined;
}

/**
 * Verifica se o aparelho esta dentro de pelo menos uma zona segura cadastrada.
 * Se o bloqueio por localizacao estiver desativado ou nao houver zonas, libera o acesso.
 */
export async function checkSafeZoneAccess(
  config: SecurityConfig
): Promise<SafeZoneCheckResult> {
  if (!config.locationLockEnabled) {
    return { allowed: true };
  }

  const zones = getConfiguredSafeZones(config);
  if (zones.length === 0) {
    return { allowed: true };
  }

  try {
    const coords = await getCurrentCoordinates();

    let nearestZone: SafeZone | null = null;
    let minDistance = Infinity;

    for (const zone of zones) {
      const dist = haversineDistanceMeters(
        coords.latitude,
        coords.longitude,
        zone.latitude,
        zone.longitude
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestZone = zone;
      }
      if (dist <= zone.radiusMeters) {
        return {
          allowed: true,
          nearestZoneName: zone.name,
          distanceMeters: dist,
        };
      }
    }

    const isAddressAsName =
      Boolean(nearestZone?.address) &&
      nearestZone!.name.trim().toLowerCase() ===
        nearestZone!.address!.split(',')[0].trim().toLowerCase();
    const safeDisplayName = nearestZone
      ? isAddressAsName
        ? 'Local Seguro'
        : nearestZone.name
      : undefined;

    return {
      allowed: false,
      nearestZoneName: safeDisplayName,
      distanceMeters: Number.isFinite(minDistance) ? minDistance : undefined,
      reason: safeDisplayName
        ? `Você está fora da zona segura "${safeDisplayName}".`
        : 'Você está fora de todas as zonas seguras cadastradas.',
    };
  } catch (err: any) {
    return {
      allowed: false,
      reason: err?.message || 'Não foi possível verificar sua localização GPS.',
    };
  }
}
