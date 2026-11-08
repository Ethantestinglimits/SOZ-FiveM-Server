import { DEFAULT_GPS_COLOR, GPS_COLORS } from '../../../../shared/gps';
import { registerSettingItem } from '../settings/registry';

registerSettingItem('map', {
    id: 'gpsColor',
    kind: 'select',
    label: 'Couleur GPS',
    description:
        'Couleur de ton point GPS et de son tracé. En véhicule, ton point est partagé aux autres occupants dans cette couleur.',
    default: DEFAULT_GPS_COLOR,
    options: GPS_COLORS.map(color => ({ value: color.id, label: color.label })),
});
