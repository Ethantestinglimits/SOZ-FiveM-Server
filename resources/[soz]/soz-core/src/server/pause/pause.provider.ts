import { On } from '../../core/decorators/event';
import { Provider } from '../../core/decorators/provider';
import { ServerEvent } from '../../shared/event';

@Provider()
export class PauseProvider {
    @On(ServerEvent.PAUSE_MENU_QUIT)
    public onQuit(source: number): void {
        DropPlayer(String(source), 'Déconnecté depuis le menu pause.');
    }
}
