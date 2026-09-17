import { Injectable } from '@public/core/decorators/injectable';

@Injectable()
export class CriminalityService {
    public isMediumCriminality() {
        return false;
    }
}
