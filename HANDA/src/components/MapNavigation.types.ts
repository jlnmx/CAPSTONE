import type { MapCoordinate } from '@services/map/googleMaps';

export type MapNavigationTarget = MapCoordinate & { title: string };
