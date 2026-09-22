/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@public/core/decorators/injectable';

@Injectable()
export class CriminalityService {
    public async isMediumCriminality(source: number): Promise<boolean> {
        return false;
    }
}
