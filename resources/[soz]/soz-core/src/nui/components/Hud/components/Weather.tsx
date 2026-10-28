import { useAssetPath } from '@public/nui/hook/assets';
import cn from 'classnames';
import { FunctionComponent, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { ForecastWithTemperature } from '../../../../shared/weather';
import { useDateTime } from '../../../hook/data';
import { useNuiEvent } from '../../../hook/nui';
import { RootState } from '../../../store';
import { useZoom } from '../hooks/useZoom';

export const Weather: FunctionComponent = () => {
    const hasWatch = useSelector((state: RootState) => state.hud.hasWatch);
    const showWeather = useSelector((state: RootState) => state.hud.settings.showWeather);

    const [forecast, setForecast] = useState<ForecastWithTemperature>();
    useNuiEvent('weather', 'forecast', setForecast);

    if (!hasWatch || !forecast || !showWeather) {
        return null;
    }

    return <WeatherView forecast={forecast} />;
};

export const WeatherView: FunctionComponent<{ forecast: ForecastWithTemperature }> = ({ forecast }) => {
    const settings = useSelector((state: RootState) => state.hud.settings);
    const { isDay } = useDateTime();
    const { getPath } = useAssetPath();
    const { largeIconSize } = useZoom();

    const weather = useMemo(() => {
        const variant = isDay ? 'day' : 'night';

        switch (forecast?.weather) {
            case 'EXTRASUNNY':
            case 'CLEAR':
                return `${variant}/sun`;
            case 'CLOUDS':
            case 'SMOG':
            case 'OVERCAST':
            case 'CLEARING':
                return `${variant}/partial_cloud`;
            case 'FOGGY':
            case 'BLIZZARD':
                return `${variant}/cloud`;
            case 'RAIN':
                return `${variant}/rain`;
            case 'THUNDER':
            case 'NEUTRAL':
                return `${variant}/thunder`;
            case 'SNOW':
            case 'SNOWLIGHT':
            case 'XMAS':
                return `${variant}/snow`;
            case 'HALLOWEEN':
                return `${variant}/storm`;
            default:
                return `${variant}/cloudy`;
        }
    }, [forecast, isDay]);

    return (
        <div className="flex pb-1.5 drop-shadow-bg">
            <div
                className={cn('leading-3 mt-1.5', {
                    'relative left-3': weather.endsWith('sun'),
                })}
                style={{ zoom: settings.zoom }}
            >
                <span className="font-semibold">{forecast?.temperature}</span>
                <span className="font-light">°C</span>
            </div>
            <img style={{ height: largeIconSize }} src={getPath(`images/hud/weather/${weather}.webp`)} />
        </div>
    );
};
