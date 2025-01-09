import { combineLatest as observableCombineLatest, Observable } from 'rxjs';
import { Component, OnInit } from '@angular/core';
import { Params } from '@angular/router';
import {
  BrowseByMetadataComponent,
  browseParamsToOptions,
} from '../browse-by-metadata/browse-by-metadata.component';
import { SortDirection, SortOptions } from '../../core/cache/models/sort-options.model';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { PaginationComponentOptions } from '../../shared/pagination/pagination-component-options.model';
import { rendersBrowseBy } from '../browse-by-switcher/browse-by-decorator';
import { BrowseByDataType } from '../browse-by-switcher/browse-by-data-type';

@Component({
  selector: 'ds-browse-by-title',
  styleUrls: ['../browse-by-metadata/browse-by-metadata.component.scss'],
  templateUrl: '../browse-by-metadata/browse-by-metadata.component.html'
})
/**
 * Component for browsing items by title (dc.title)
 */
@rendersBrowseBy(BrowseByDataType.Title)
export class BrowseByTitleComponent extends BrowseByMetadataComponent implements OnInit {

  ngOnInit(): void {
    const sortConfig = new SortOptions('dc.title', SortDirection.ASC);
    this.currentPagination$ = this.paginationService.getCurrentPagination(this.paginationConfig.id, this.paginationConfig);
    this.currentSort$ = this.paginationService.getCurrentSort(this.paginationConfig.id, sortConfig);
    const routeParams$: Observable<Params> = observableCombineLatest([
      this.route.params,
      this.route.queryParams,
    ]).pipe(
      map(([params, queryParams]: [Params, Params]) => Object.assign({}, params, queryParams)),
      distinctUntilChanged((prev: Params, curr: Params) => prev.id === curr.id && prev.startsWith === curr.startsWith),
    );
    this.subs.push(
      observableCombineLatest([
        routeParams$,
        this.scope$,
        this.currentPagination$,
        this.currentSort$,
      ]).subscribe(([params, scope, currentPage, currentSort]: [Params, string, PaginationComponentOptions, SortOptions]) => {
        this.startsWith = +params.startsWith || params.startsWith;
        this.browseId = params.id || this.defaultBrowseId;
        this.updatePageWithItems(browseParamsToOptions(params, scope, currentPage, currentSort, this.browseId, this.fetchThumbnails), undefined, undefined);
      }));
    this.updateStartsWithTextOptions();
  }

}
