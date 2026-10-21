import { LocationMarkerIcon } from '@heroicons/react/outline';
import clsx from 'clsx';
import { FunctionComponent } from 'react';

import { IconComponentProps } from '../../system/phone.types';

const GpsIcon: FunctionComponent<IconComponentProps> = ({ className, ...props }) => (
    <LocationMarkerIcon
        {...props}
        className={clsx('text-white bg-gradient-to-br from-emerald-500 to-emerald-700 p-3', className)}
    />
);

export default GpsIcon;
