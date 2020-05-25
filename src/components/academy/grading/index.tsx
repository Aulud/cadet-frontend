import {
  Button,
  Colors,
  ControlGroup,
  Intent,
  Menu,
  MenuItem,
  NonIdealState,
  Spinner,
  TagInput
} from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';
import { ItemListRenderer, ItemRenderer, Select } from '@blueprintjs/select';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid/dist/styles/ag-grid.css';
import 'ag-grid/dist/styles/ag-theme-balham.css';
import * as React from 'react';
import { RouteComponentProps } from 'react-router';

import GradingWorkspaceContainer from '../../../containers/academy/grading/GradingWorkspaceContainer';
import { stringParamToInt } from '../../../utils/paramParseHelpers';
import ContentDisplay from '../../commons/ContentDisplay';
import GradingHistory from './GradingHistory';
import GradingNavLink from './GradingNavLink';
import { GradingOverview } from './gradingShape';
import { OwnProps as GradingWorkspaceProps } from './GradingWorkspace';

/**
 * Column Definitions are defined within the state, so that data
 * can be manipulated easier. See constructor for an example.
 */
type State = {
  columnDefs: ColDef[];
  searchTags: string[];
  groupFilterEnabled: boolean;
  pageSize: number;
  pageSizeDesc: string;
};

type GradingNavLinkProps = {
  data: GradingOverview;
};

interface IGradingProps
  extends IDispatchProps,
    IStateProps,
    RouteComponentProps<IGradingWorkspaceParams> {}

export interface IGradingWorkspaceParams {
  submissionId?: string;
  questionId?: string;
}

export interface IDispatchProps {
  handleFetchGradingOverviews: (
    pageSize: number,
    pageNo: number,
    searchTags: string[],
    filterToGroup: boolean,
    filterModel: object,
    sortModel: object
  ) => void;
}

export interface IStateProps {
  currPage?: number;
  gradingOverviews?: GradingOverview[];
  maxPages?: number;
}

/** Component to render in table - grading status */
const GradingStatus = (props: GradingNavLinkProps) => {
  return <GradingHistory data={props.data} exp={false} grade={false} status={true} />;
};

/** Component to render in table - marks */
const GradingMarks = (props: GradingNavLinkProps) => {
  return <GradingHistory data={props.data} exp={false} grade={true} status={false} />;
};

/** Component to render in table - XP */
const GradingExp = (props: GradingNavLinkProps) => {
  return <GradingHistory data={props.data} exp={true} grade={false} status={false} />;
};

class Grading extends React.Component<IGradingProps, State> {
  private gridApi?: GridApi;

  public constructor(props: IGradingProps) {
    super(props);

    this.state = {
      columnDefs: [
        {
          headerName: 'Assessment Name',
          field: 'assessmentName',
          suppressFilter: true
        },
        {
          headerName: 'Category',
          field: 'assessmentCategory',
          maxWidth: 120,
          suppressFilter: true
        },
        {
          headerName: 'Student Name',
          field: 'studentName',
          suppressFilter: true
        },
        {
          headerName: 'Status',
          field: 'gradingStatus',
          cellRendererFramework: GradingStatus,
          maxWidth: 90,
          suppressFilter: true
          // This column has a custom sort order: ungraded > grading > graded > none (N/A)
          // Sorting in ascending order thus brings ungraded submissions to top
        },
        {
          headerName: 'Grade',
          field: 'gradeDisplay',
          filter: 'agNumberColumnFilter',
          filterParams: {
            applyButton: true,
            // Enforce 50ms delay after 'APPLY' button
            // Ensures ag-grid has time to update filter values in filter model prior to API call
            debounceMs: 50,
            filterOptions: [
              'equals',
              'notEqual',
              'lessThanOrEqual',
              'greaterThanOrEqual',
              'inRange'
            ],
            inRangeInclusive: true,
            // Keep filter state after reloading data
            newRowsAction: 'keep',
            suppressAndOrCondition: true
          },
          cellRendererFramework: GradingMarks,
          maxWidth: 100,
          cellStyle: params => {
            if (params.data.currentGrade < params.data.maxGrade) {
              return { backgroundColor: Colors.RED5 };
            } else {
              return {};
            }
          }
        },
        {
          headerName: 'XP',
          field: 'xpDisplay',
          filter: 'agNumberColumnFilter',
          filterParams: {
            applyButton: true,
            debounceMs: 50,
            filterOptions: [
              'equals',
              'notEqual',
              'lessThanOrEqual',
              'greaterThanOrEqual',
              'inRange'
            ],
            inRangeInclusive: true,
            newRowsAction: 'keep',
            suppressAndOrCondition: true
          },
          cellRendererFramework: GradingExp,
          maxWidth: 100
        },
        {
          headerName: 'Group',
          field: 'groupName',
          maxWidth: 120,
          suppressFilter: true
        },
        {
          headerName: '',
          field: '',
          cellRendererFramework: GradingNavLink,
          maxWidth: 40,
          suppressSorting: true,
          suppressFilter: true
        },
        { headerName: 'Question Count', field: 'questionCount', hide: true },
        { headerName: 'Questions Graded', field: 'gradedCount', hide: true },
        { headerName: 'Initial Grade', field: 'initialGrade', hide: true },
        { headerName: 'Grade Adjustment', field: 'gradeAdjustment', hide: true },
        { headerName: 'Initial XP', field: 'initialXp', hide: true },
        { headerName: 'XP Adjustment', field: 'xpAdjustment', hide: true },
        { headerName: 'Current Grade', field: 'currentGrade', hide: true },
        { headerName: 'Max Grade', field: 'maxGrade', hide: true },
        { headerName: 'Current XP', field: 'currentXp', hide: true },
        { headerName: 'Max XP', field: 'maxXp', hide: true },
        { headerName: 'Bonus XP', field: 'xpBonus', hide: true }
      ],
      groupFilterEnabled: false,
      pageSize: 4,
      pageSizeDesc: '4 entries per page',
      searchTags: []
    };
  }

  public render() {
    const submissionId: number | null = stringParamToInt(this.props.match.params.submissionId);
    // default questionId is 0 (the first question)
    const questionId: number = stringParamToInt(this.props.match.params.questionId) || 0;

    const PageSizeSelect = Select.ofType<string>();
    const pageSizeOpts: string[] = ['10', '20', '25', '40', 'All'];
    const renderPageSizeMenu: ItemListRenderer<string> = ({
      items,
      itemsParentRef,
      query,
      renderItem
    }) => {
      const renderedItems = items.map(renderItem);
      return <Menu ulRef={itemsParentRef}>{renderedItems}</Menu>;
    };
    const renderPageSizeChoice: ItemRenderer<string> = (size, { handleClick, modifiers }) => {
      return <MenuItem active={modifiers.active} key={size} onClick={handleClick} text={size} />;
    };

    /* Create a workspace to grade a submission. */
    if (submissionId !== null) {
      const props: GradingWorkspaceProps = {
        submissionId,
        questionId
      };
      return <GradingWorkspaceContainer {...props} />;
    }

    /* Display either a loading screen or a table with overviews. */
    const loadingDisplay = (
      <NonIdealState
        className="Grading"
        description="Fetching submissions..."
        visual={<Spinner large={true} />}
      />
    );

    const grid = (
      <div className="GradingContainer">
        <div className="GradingControls">
          <div className="pagination-controls">
            <ControlGroup fill={false} vertical={false}>
              <PageSizeSelect
                className="pageSizeDropdown"
                filterable={false}
                itemListRenderer={renderPageSizeMenu}
                itemRenderer={renderPageSizeChoice}
                items={pageSizeOpts}
                onItemSelect={this.handleChangePageSize}
                popoverProps={{ minimal: true }}
              >
                <Button text={'Show ' + this.state.pageSizeDesc} rightIcon="caret-down" />
              </PageSizeSelect>
              <TagInput
                className="searchBar"
                large={false}
                leftIcon="filter"
                placeholder="Search by student, assessment, category or group"
                values={this.state.searchTags}
                onChange={this.handleSearchChange}
              />
            </ControlGroup>
          </div>

          <div>
            <div className="ag-grid-controls left">
              <Button
                active={this.state.groupFilterEnabled}
                icon={IconNames.GIT_REPO}
                intent={this.state.groupFilterEnabled ? Intent.PRIMARY : Intent.NONE}
                onClick={this.handleGroupsFilter}
              >
                <div className="ag-grid-button-text hidden-xs">Show all groups</div>
              </Button>
            </div>
            <div className="ag-grid-controls paginate">
              <Button
                icon={IconNames.CHEVRON_BACKWARD}
                onClick={this.handleLoadFirst}
                minimal={true}
                disabled={this.props.currPage! < 2}
              />
              <Button
                icon={IconNames.CHEVRON_LEFT}
                onClick={this.handleLoadPrev}
                minimal={true}
                disabled={this.props.currPage! < 2}
              />
              <Button
                className="ag-paginate-info hidden-xs"
                icon={IconNames.DRAG_HANDLE_VERTICAL}
                rightIcon={IconNames.DRAG_HANDLE_VERTICAL}
                minimal={true}
                disabled={true}
              >
                {`Page ${this.props.currPage} of ${this.props.maxPages}`}
              </Button>
              <Button
                icon={IconNames.CHEVRON_RIGHT}
                onClick={this.handleLoadNext}
                minimal={true}
                disabled={this.props.currPage! >= this.props.maxPages!}
              />
              <Button
                icon={IconNames.CHEVRON_FORWARD}
                onClick={this.handleLoadEnd}
                minimal={true}
                disabled={this.props.currPage! >= this.props.maxPages!}
              />
            </div>
            <div className="ag-grid-controls right">
              <Button icon={IconNames.EXPORT} onClick={this.exportCSV}>
                <div className="ag-grid-button-text hidden-xs">Export to CSV</div>
              </Button>
            </div>
          </div>
        </div>

        <hr />

        <div className="Grading">
          <div className="ag-grid-parent ag-theme-balham">
            <AgGridReact
              // Grid properties
              enableColResize={true}
              enableSorting={true}
              enableServerSideFilter={true}
              enableServerSideSorting={true}
              enableFilter={true}
              gridAutoHeight={true}
              pagination={false}
              suppressChangeDetection={true}
              suppressPaginationPanel={true}
              // Grid data
              columnDefs={this.state.columnDefs}
              rowData={this.props.gradingOverviews}
              // Grid events
              onFilterChanged={this.handleGridUpdate}
              onSortChanged={this.handleGridUpdate}
              onGridReady={this.onGridReady}
            />
          </div>
        </div>
      </div>
    );
    return (
      <ContentDisplay
        loadContentDispatch={this.handleLoadFirst}
        display={this.props.gradingOverviews === undefined ? loadingDisplay : grid}
        fullWidth={false}
      />
    );
  }

  // Reloads data when pagination page size changes
  private handleChangePageSize = (item: string, event?: React.SyntheticEvent<HTMLElement>) => {
    const newPageSize = item === 'All' ? 100000 : Number(item);
    const newPageSizeDesc = item === 'All' ? 'all entries' : item + ' entries per page';

    this.setState({ pageSize: newPageSize, pageSizeDesc: newPageSizeDesc });

    this.props.handleFetchGradingOverviews(
      newPageSize,
      1,
      this.state.searchTags,
      this.state.groupFilterEnabled,
      this.gridApi!.getFilterModel(),
      this.gridApi!.getSortModel()
    );
  };

  // Reloads data when search tags updated
  private handleSearchChange = (newSearchTags: string[]) => {
    this.setState({ searchTags: newSearchTags });
    this.props.handleFetchGradingOverviews(
      this.state.pageSize,
      1,
      newSearchTags,
      this.state.groupFilterEnabled,
      this.gridApi!.getFilterModel(),
      this.gridApi!.getSortModel()
    );
  };

  // Reloads data when option to show students of all groups is toggled
  private handleGroupsFilter = () => {
    const newState = !this.state.groupFilterEnabled;
    this.setState({ groupFilterEnabled: newState });
    this.props.handleFetchGradingOverviews(
      this.state.pageSize,
      1,
      this.state.searchTags,
      newState,
      this.gridApi!.getFilterModel(),
      this.gridApi!.getSortModel()
    );
  };

  // Reloads data when filter or sort model of grid changes
  private handleGridUpdate = () => {
    this.props.handleFetchGradingOverviews(
      this.state.pageSize,
      1,
      this.state.searchTags,
      this.state.groupFilterEnabled,
      this.gridApi!.getFilterModel(),
      this.gridApi!.getSortModel()
    );
  };

  private handleLoadFirst = () => {
    this.props.handleFetchGradingOverviews(
      this.state.pageSize,
      1,
      this.state.searchTags,
      this.state.groupFilterEnabled,
      this.gridApi ? this.gridApi.getFilterModel() : {},
      this.gridApi ? this.gridApi.getSortModel() : {}
    );
    // tslint:disable-next-line
    console.log(`Current page: ${this.props.currPage}, maximum page: ${this.props.maxPages}`);
    // tslint:disable-next-line
    console.log(`Submissions in REDUX store: ${this.props.gradingOverviews!}`);
  };

  private handleLoadPrev = () => {
    this.props.handleFetchGradingOverviews(
      this.state.pageSize,
      this.props.currPage! - 1,
      this.state.searchTags,
      this.state.groupFilterEnabled,
      this.gridApi!.getFilterModel(),
      this.gridApi!.getSortModel()
    );
  };

  private handleLoadNext = () => {
    this.props.handleFetchGradingOverviews(
      this.state.pageSize,
      this.props.currPage! + 1,
      this.state.searchTags,
      this.state.groupFilterEnabled,
      this.gridApi!.getFilterModel(),
      this.gridApi!.getSortModel()
    );
  };

  private handleLoadEnd = () => {
    this.props.handleFetchGradingOverviews(
      this.state.pageSize,
      this.props.maxPages!,
      this.state.searchTags,
      this.state.groupFilterEnabled,
      this.gridApi!.getFilterModel(),
      this.gridApi!.getSortModel()
    );
  };

  private onGridReady = (params: GridReadyEvent) => {
    this.gridApi = params.api;
    this.gridApi.sizeColumnsToFit();
  };

  private exportCSV = () => {
    if (this.gridApi === undefined) {
      return;
    }
    this.gridApi.exportDataAsCsv({ allColumns: true });
  };
}

export default Grading;
