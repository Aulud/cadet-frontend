import { Colors, FormGroup, InputGroup, NonIdealState, Spinner } from '@blueprintjs/core';
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
// import { GradingStatuses } from '../../assessment/assessmentShape';
import { controlButton } from '../../commons';
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
  handleFetchGradingOverviews: (filterToGroup?: boolean) => void;
}

export interface IStateProps {
  gradingOverviews?: GradingOverview[];
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
          maxWidth: 90
        },
        {
          headerName: 'Edit',
          field: '',
          cellRendererFramework: GradingNavLink,
          maxWidth: 75
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
          <FormGroup label="Filter:" labelFor="text-input" inline={true}>
            <InputGroup
              id="filterBar"
              large={false}
              leftIcon="filter"
              placeholder="Enter any text (e.g. mission)"
              value={this.state.filterValue}
              onChange={this.handleFilterChange}
            />
          </FormGroup>

          <div className="checkboxPanel">
            <label>Show All Submissions:</label>
            &nbsp;&nbsp;
            <input
              name="showAllSubmissions"
              type="checkbox"
              checked={this.state.groupFilterEnabled}
              onChange={this.handleGroupsFilter}
            />
          </div>
        </div>

        <hr />
        <br />

        <div className="Grading">
          <div className="ag-grid-parent ag-theme-fresh">
            <AgGridReact
              gridAutoHeight={true}
              enableColResize={true}
              enableSorting={true}
              enableFilter={true}
              columnDefs={this.state.columnDefs}
              onGridReady={this.onGridReady}
              rowData={data}
              pagination={true}
              paginationPageSize={50}
            />
          </div>
          <div className="ag-grid-export-button">
            {controlButton('Export to CSV', IconNames.EXPORT, this.exportCSV)}
          </div>
        </div>
      </div>
    );
    return (
      <ContentDisplay
        loadContentDispatch={this.props.handleFetchGradingOverviews}
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

  private handleGroupsFilter = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checkStatus = event.target.checked;
    this.setState({ groupFilterEnabled: checkStatus });
    this.props.handleFetchGradingOverviews(!checkStatus);
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
