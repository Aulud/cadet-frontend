import { Button, Colors, FormGroup, InputGroup, Intent, NonIdealState, Spinner } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid/dist/styles/ag-grid.css';
import 'ag-grid/dist/styles/ag-theme-balham.css';
import { sortBy } from 'lodash';
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
  filterValue: string;
  groupFilterEnabled: boolean;
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
  handleFetchGradingOverviews: (pageNo: number, filterToGroup?: boolean) => void;
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
        { headerName: 'Assessment Name', field: 'assessmentName' },
        { headerName: 'Category', field: 'assessmentCategory', maxWidth: 120 },
        { headerName: 'Student Name', field: 'studentName' },
        {
          headerName: 'Status',
          field: 'gradingStatus',
          cellRendererFramework: GradingStatus,
          maxWidth: 90,
          // Specify custom ordering of grading states: none > graded > grading > ungraded
          // Sorting in ascending order thus brings ungraded submissions to top
          // Comparison done by string length
          comparator: (valueA, valueB, nodeA, nodeB, isInverted) => {
            return valueB.length - valueA.length;
          }
        },
        {
          headerName: 'Grade',
          field: '',
          cellRendererFramework: GradingMarks,
          maxWidth: 100,
          cellStyle: params => {
            if (params.data.currentGrade < params.data.maxGrade) {
              return { backgroundColor: Colors.RED5 };
            } else {
              return {};
            }
          },
          comparator: (valueA, valueB, nodeA, nodeB, isInverted) => {
            if (nodeA && nodeB) {
              return nodeA.data.currentGrade - nodeB.data.currentGrade;
            } else {
              return valueA - valueB;
            }
          }
        },
        {
          headerName: 'XP',
          field: '',
          cellRendererFramework: GradingExp,
          maxWidth: 100,
          comparator: (valueA, valueB, nodeA, nodeB, isInverted) => {
            if (nodeA && nodeB) {
              return nodeA.data.currentXp - nodeB.data.currentXp;
            } else {
              return valueA - valueB;
            }
          }
        },
        {
          headerName: 'Group',
          field: 'groupName',
          maxWidth: 120
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
      filterValue: '',
      groupFilterEnabled: false
    };
  }

  public render() {
    const submissionId: number | null = stringParamToInt(this.props.match.params.submissionId);
    // default questionId is 0 (the first question)
    const questionId: number = stringParamToInt(this.props.match.params.questionId) || 0;

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
    const data = sortBy(this.props.gradingOverviews, [
      (a: GradingOverview) => -a.assessmentId,
      (a: GradingOverview) => -a.submissionId
    ]);

    const grid = (
      <div className="GradingContainer">
        <div>
          <FormGroup label="Search:" labelFor="text-input" inline={true}>
            <InputGroup
              id="filterBar"
              large={false}
              leftIcon="filter"
              placeholder="Enter any text (e.g. mission)"
              value={this.state.filterValue}
              onChange={this.handleFilterChange}
            />
          </FormGroup>
        </div>
          
        <div>
          <div className="ag-grid-controls left">
            <Button active={this.state.groupFilterEnabled} icon={IconNames.GIT_REPO}
              intent={this.state.groupFilterEnabled ? Intent.PRIMARY : Intent.NONE}
              onClick={this.handleGroupsFilter}>
              <div className="ag-grid-button-text hidden-xs">Show all groups</div>
            </Button>
          </div>
          <div className="ag-grid-controls paginate">
            <Button icon={IconNames.CHEVRON_BACKWARD} onClick={this.handleLoadFirst} 
                minimal={true} disabled={this.props.currPage! < 2} />
              <Button icon={IconNames.CHEVRON_LEFT} onClick={this.handleLoadPrev} 
                minimal={true} disabled={this.props.currPage! < 2} />
              <Button className = "ag-paginate-info hidden-xs" icon={IconNames.DRAG_HANDLE_VERTICAL}
                rightIcon={IconNames.DRAG_HANDLE_VERTICAL} minimal = {true} disabled={true}>
               {`Page ${this.props.currPage} of ${this.props.maxPages}`}
              </Button>
              <Button icon={IconNames.CHEVRON_RIGHT} onClick={this.handleLoadNext} 
                minimal={true} disabled={this.props.currPage! >= this.props.maxPages!} />
              <Button icon={IconNames.CHEVRON_FORWARD} onClick={this.handleLoadEnd} 
                minimal={true} disabled={this.props.currPage! >= this.props.maxPages!} />
          </div>
          <div className="ag-grid-controls right">
            <Button icon={IconNames.EXPORT} onClick={this.exportCSV}>
              <div className="ag-grid-button-text hidden-xs">Export to CSV</div>
            </Button>
          </div>
        </div>

        <hr />

        <div className="Grading">
          <div className="ag-grid-parent ag-theme-balham">
            <AgGridReact
              gridAutoHeight={true}
              enableColResize={true}
              enableSorting={true}
              enableFilter={true}
              columnDefs={this.state.columnDefs}
              onGridReady={this.onGridReady}
              rowData={data}
              pagination={true}
              paginationPageSize={6}
              suppressPaginationPanel={true}
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

  private handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const changeVal = event.target.value;
    this.setState({ filterValue: changeVal });

    if (this.gridApi) {
      this.gridApi.setQuickFilter(changeVal);
    }
  };

  private handleGroupsFilter = () => {
    const newState = !this.state.groupFilterEnabled;
    this.setState({ groupFilterEnabled: newState });
    this.props.handleFetchGradingOverviews(1, newState);
    // tslint:disable-next-line
    console.log(`Current page in props: ${this.props.currPage}, maximum page in state: ${this.props.maxPages}`);
  };

  private handleLoadFirst = () => {
    this.props.handleFetchGradingOverviews(1, this.state.groupFilterEnabled);
    // this.setState({ currPage: 1 });
    // tslint:disable-next-line
    console.log(`Current page in props: ${this.props.currPage}, maximum page in state: ${this.props.maxPages}`);
  };

  private handleLoadPrev = () => {
    this.props.handleFetchGradingOverviews(this.props.currPage! - 1, this.state.groupFilterEnabled);
    // tslint:disable-next-line
    console.log(`Current page in props: ${this.props.currPage}, maximum page in state: ${this.props.maxPages}`);
  };

  private handleLoadNext = () => {
    this.props.handleFetchGradingOverviews(this.props.currPage! + 1, this.state.groupFilterEnabled);
    // tslint:disable-next-line
    console.log(`Current page in props: ${this.props.currPage}, maximum page in state: ${this.props.maxPages}`);
  };

  private handleLoadEnd = () => {
    this.props.handleFetchGradingOverviews(this.props.maxPages!, this.state.groupFilterEnabled);
    // tslint:disable-next-line
    console.log(`Current page in props: ${this.props.currPage}, maximum page in state: ${this.props.maxPages}`);
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
