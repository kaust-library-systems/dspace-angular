import { BehaviorSubject, combineLatest as observableCombineLatest, Observable, Subscription, of as observableOf } from 'rxjs';
import { Component, Inject, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { RemoteData } from '../../core/data/remote-data';
import { PaginatedList } from '../../core/data/paginated-list.model';
import { PaginationComponentOptions } from '../../shared/pagination/pagination-component-options.model';
import { SortDirection, SortOptions } from '../../core/cache/models/sort-options.model';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { hasValue, isNotEmpty } from '../../shared/empty.util';
import { BrowseService } from '../../core/browse/browse.service';
import { BrowseEntry } from '../../core/shared/browse-entry.model';
import { Item } from '../../core/shared/item.model';
import { BrowseEntrySearchOptions } from '../../core/browse/browse-entry-search-options.model';
import { getFirstSucceededRemoteData } from '../../core/shared/operators';
import { DSpaceObjectDataService } from '../../core/data/dspace-object-data.service';
import { StartsWithType } from '../../shared/starts-with/starts-with-decorator';
import { PaginationService } from '../../core/pagination/pagination.service';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { APP_CONFIG, AppConfig } from '../../../config/app-config.interface';
import { DSONameService } from '../../core/breadcrumbs/dso-name.service';
import { rendersBrowseBy } from '../browse-by-switcher/browse-by-decorator';
import { BrowseByDataType } from '../browse-by-switcher/browse-by-data-type';
import { Context } from '../../core/shared/context.model';

export const BBM_PAGINATION_ID = 'bbm';

@Component({
  selector: 'ds-browse-by-metadata',
  styleUrls: ['./browse-by-metadata.component.scss'],
  templateUrl: './browse-by-metadata.component.html',
})
/**
 * Component for browsing (items) by metadata definition.
 * A metadata definition (a.k.a. browse id) is a short term used to describe one
 * or multiple metadata fields.  An example would be 'author' for
 * 'dc.contributor.*'
 */
@rendersBrowseBy(BrowseByDataType.Metadata)
export class BrowseByMetadataComponent implements OnInit, OnChanges, OnDestroy {

  /**
   * The optional context
   */
  @Input() context: Context;

  /**
   * The {@link BrowseByDataType} of this Component
   */
  @Input() browseByType: BrowseByDataType;

  /**
   * The ID of the {@link Community} or {@link Collection} of the scope to display
   */
  @Input() scope: string;

  /**
   * Display the h1 title in the section
   */
  @Input() displayTitle = true;

  scope$: BehaviorSubject<string> = new BehaviorSubject(undefined);

  /**
   * The list of browse-entries to display
   */
  browseEntries$: Observable<RemoteData<PaginatedList<BrowseEntry>>>;

  /**
   * The list of items to display when a value is present
   */
  items$: Observable<RemoteData<PaginatedList<Item>>>;

  /**
   * The pagination config used to display the values
   */
  paginationConfig: PaginationComponentOptions;

  /**
   * The pagination observable
   */
  currentPagination$: Observable<PaginationComponentOptions>;

  /**
   * The sorting config observable
   */
  currentSort$: Observable<SortOptions>;

  /**
   * List of subscriptions
   */
  subs: Subscription[] = [];

  /**
   * The default browse id to resort to when none is provided
   */
  defaultBrowseId = 'author';

  /**
   * The current browse id
   */
  browseId = this.defaultBrowseId;

  /**
   * The type of StartsWith options to render
   * Defaults to text
   */
  startsWithType = StartsWithType.text;

  /**
   * The list of StartsWith options
   * Should be defined after ngOnInit is called!
   */
  startsWithOptions: (string | number)[];

  /**
   * The value we're browsing items for
   * - When the value is not empty, we're browsing items
   * - When the value is empty, we're browsing browse-entries (values for the given metadata definition)
   */
  value = '';

  /**
   * The authority key (may be undefined) associated with {@link #value}.
   */
   authority: string;

  /**
   * The current startsWith option (fetched and updated from query-params)
   */
  startsWith: string;

  /**
   * Determines whether to request embedded thumbnail.
   */
  fetchThumbnails: boolean;

  /**
   * Observable determining if the loading animation needs to be shown
   */
  loading$ = observableOf(true);

  public constructor(protected route: ActivatedRoute,
                     protected browseService: BrowseService,
                     protected dsoService: DSpaceObjectDataService,
                     protected paginationService: PaginationService,
                     protected router: Router,
                     @Inject(APP_CONFIG) public appConfig: AppConfig,
                     public dsoNameService: DSONameService,
  ) {
    this.fetchThumbnails = this.appConfig.browseBy.showThumbnails;
    this.paginationConfig = Object.assign(new PaginationComponentOptions(), {
        id: BBM_PAGINATION_ID,
        currentPage: 1,
        pageSize: this.appConfig.browseBy.pageSize,
        });
    }


  ngOnInit(): void {

    const sortConfig = new SortOptions('default', SortDirection.ASC);
    this.currentPagination$ = this.paginationService.getCurrentPagination(this.paginationConfig.id, this.paginationConfig);
    this.currentSort$ = this.paginationService.getCurrentSort(this.paginationConfig.id, sortConfig);
    const routeParams$: Observable<Params> = observableCombineLatest([
      this.route.params,
      this.route.queryParams,
    ]).pipe(
      map(([params, queryParams]: [Params, Params]) => Object.assign({}, params, queryParams)),
      distinctUntilChanged((prev: Params, curr: Params) => prev.id === curr.id && prev.authority === curr.authority && prev.value === curr.value && prev.startsWith === curr.startsWith),
    );
    this.subs.push(
      observableCombineLatest([
        routeParams$,
        this.scope$,
        this.currentPagination$,
        this.currentSort$,
      ]).subscribe(([params, scope, currentPage, currentSort]: [Params, string, PaginationComponentOptions, SortOptions]) => {
        this.browseId = params.id || this.defaultBrowseId;
          this.authority = params.authority;

          if (typeof params.value === 'string'){
            this.value = params.value.trim();
          } else {
            this.value = '';
          }

          if (typeof params.startsWith === 'string'){
            this.startsWith = params.startsWith.trim();
          }

          if (isNotEmpty(this.value)) {
            this.updatePageWithItems(browseParamsToOptions(params, scope, currentPage, currentSort, this.browseId, this.fetchThumbnails), this.value, this.authority);
          } else {
            this.updatePage(browseParamsToOptions(params, scope, currentPage, currentSort, this.browseId, false));
          }
        }));
    this.updateStartsWithTextOptions();

  }

  ngOnChanges(changes: SimpleChanges): void {
    if (hasValue(changes.scope)) {
      this.scope$.next(this.scope);
    }
  }

  /**
   * Update the StartsWith options with text values
   * It adds the value "0-9" as well as all letters from A to Z
   */
  updateStartsWithTextOptions() {
    this.startsWithOptions = ['0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
  }

  /**
   * Updates the current page with searchOptions
   * @param searchOptions   Options to narrow down your search:
   *                        { metadata: string
   *                          pagination: PaginationComponentOptions,
   *                          sort: SortOptions,
   *                          scope: string }
   */
  updatePage(searchOptions: BrowseEntrySearchOptions) {
    this.browseEntries$ = this.browseService.getBrowseEntriesFor(searchOptions);
    this.loading$ = this.browseEntries$.pipe(
      map((browseEntriesRD: RemoteData<PaginatedList<BrowseEntry>>) => browseEntriesRD.isLoading),
    );
    this.items$ = undefined;
  }

  /**
   * Updates the current page with searchOptions and display items linked to the given value
   * @param searchOptions   Options to narrow down your search:
   *                        { metadata: string
   *                          pagination: PaginationComponentOptions,
   *                          sort: SortOptions,
   *                          scope: string }
   * @param value          The value of the browse-entry to display items for
   */
  updatePageWithItems(searchOptions: BrowseEntrySearchOptions, value: string, authority: string) {
    this.items$ = this.browseService.getBrowseItemsFor(value, authority, searchOptions);
    this.loading$ = this.items$.pipe(
      map((itemsRD: RemoteData<PaginatedList<Item>>) => itemsRD.isLoading),
    );
  }

  /**
   * Navigate to the previous page
   */
  goPrev() {
    if (this.items$) {
      this.items$.pipe(getFirstSucceededRemoteData()).subscribe((items) => {
        this.items$ = this.browseService.getPrevBrowseItems(items);
      });
    } else if (this.browseEntries$) {
      this.browseEntries$.pipe(getFirstSucceededRemoteData()).subscribe((entries) => {
        this.browseEntries$ = this.browseService.getPrevBrowseEntries(entries);
      });
    }
  }

  /**
   * Navigate to the next page
   */
  goNext() {
    if (this.items$) {
      this.items$.pipe(getFirstSucceededRemoteData()).subscribe((items) => {
        this.items$ = this.browseService.getNextBrowseItems(items);
      });
    } else if (this.browseEntries$) {
      this.browseEntries$.pipe(getFirstSucceededRemoteData()).subscribe((entries) => {
        this.browseEntries$ = this.browseService.getNextBrowseEntries(entries);
      });
    }
  }

  ngOnDestroy(): void {
    this.subs.filter((sub: Subscription) => hasValue(sub)).forEach((sub: Subscription) => sub.unsubscribe());
    this.paginationService.clearPagination(this.paginationConfig.id);
  }


}

/**
 * Creates browse entry search options.
 * @param defaultBrowseId the metadata definition to fetch entries or items for
 * @param paginationConfig the required pagination configuration
 * @param sortConfig the required sort configuration
 * @param fetchThumbnails optional boolean for fetching thumbnails
 * @returns BrowseEntrySearchOptions instance
 */
export function getBrowseSearchOptions(defaultBrowseId: string,
                                       paginationConfig: PaginationComponentOptions,
                                       sortConfig: SortOptions,
                                       fetchThumbnails?: boolean) {
  if (!hasValue(fetchThumbnails)) {
    fetchThumbnails = false;
  }
  return new BrowseEntrySearchOptions(defaultBrowseId, paginationConfig, sortConfig, null,
    null, fetchThumbnails);
}

/**
 * Function to transform query and url parameters into searchOptions used to fetch browse entries or items
 * @param params            URL and query parameters
 * @param scope             The scope to show the results
 * @param paginationConfig  Pagination configuration
 * @param sortConfig        Sorting configuration
 * @param metadata          Optional metadata definition to fetch browse entries/items for
 * @param fetchThumbnail   Optional parameter for requesting thumbnail images
 */
export function browseParamsToOptions(params: any,
                                      scope: string,
                                      paginationConfig: PaginationComponentOptions,
                                      sortConfig: SortOptions,
                                      metadata?: string,
                                      fetchThumbnail?: boolean): BrowseEntrySearchOptions {
  return new BrowseEntrySearchOptions(
    metadata,
    paginationConfig,
    sortConfig,
    params.startsWith,
    scope,
    fetchThumbnail
  );
}
