import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { RemoteData } from '../core/data/remote-data';
import { followLink } from '../shared/utils/follow-link-config.model';
import { WorkflowItemDataService } from '../core/submission/workflowitem-data.service';
import { WorkflowItem } from '../core/submission/models/workflowitem.model';
import { getFirstCompletedRemoteData } from '../core/shared/operators';

/**
 * This class represents a resolver that requests a specific workflow item before the route is activated
 */
@Injectable()
export class WorkflowItemPageResolver  {
  constructor(private workflowItemService: WorkflowItemDataService) {
  }

  /**
   * Method for resolving a workflow item based on the parameters in the current route
   * @param {ActivatedRouteSnapshot} route The current ActivatedRouteSnapshot
   * @param {RouterStateSnapshot} state The current RouterStateSnapshot
   * @returns Observable<<RemoteData<Item>> Emits the found workflow item based on the parameters in the current route,
   * or an error if something went wrong
   */
  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<RemoteData<WorkflowItem>> {
    return this.workflowItemService.findById(route.params.id,
      true,
      false,
      followLink('item'),
    ).pipe(
      getFirstCompletedRemoteData(),
    );
  }
}
