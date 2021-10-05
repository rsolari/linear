import csv from "csvtojson";
import { Importer, ImportResult } from "../../types";

type ClickupPriority = "null" | "1" | "2" | "3" | "4";

interface ClickupIssueType {
  "Task ID": string;
  "Task Name": string;
  "Task Content": string;
  Status: string;
  "Date Created": string;
  "Start Date": number;
  Assignees: string;
  Tags: string;
  Priority: ClickupPriority;
  "Space Name": string;
  "List Name": string;
  "Folder Name": string;
  "Time Estimated": string;
  Comments: string;
  Attachments: string;
}

interface ClickupComment {
  text: string;
  by: string;
}

interface ClickupAttachment {
  title: string;
  url: string;
}

/**
 * Import issues from Clickup CSV export.
 *
 * @param filePath  path to csv file
 */
export class ClickupCsvImporter implements Importer {
  public constructor(filePath: string) {
    this.filePath = filePath;
  }

  public get name(): string {
    return "Clickup (CSV)";
  }

  public get defaultTeamName(): string {
    return "Clickup";
  }

  public import = async (): Promise<ImportResult> => {
    const data = (await csv().fromFile(this.filePath)) as ClickupIssueType[];

    const importData: ImportResult = {
      issues: [],
      labels: {},
      users: {},
      statuses: {},
    };

    const assignees = data.reduce((acc, row) => {
      const rowAssignees = row.Assignees.slice(1, -1).split(",");
      rowAssignees.map(assignee => acc.add(assignee));
      return acc;
    }, new Set<string>([]));

    for (const user of assignees) {
      importData.users[user] = {
        name: user,
      };
    }

    for (const row of data) {
      // add labels
      const tags = row.Tags.slice(1, -1).split(",");
      if (row["List Name"]) {
        tags.push(row["List Name"]);
      }
      if (row["Folder Name"] !== "hidden") {
        tags.push(row["Folder Name"]);
      }
      const labels = tags.filter(tag => !!tag);

      // build description
      const description = row["Task Content"] !== "null" ? row["Task Content"] : "";
      const comments: ClickupComment[] = JSON.parse(row.Comments);
      const commentsText = comments
        .map(comment => {
          return `${comment.by} said: ${comment.text}`;
        })
        .join("\n");

      const attachments: ClickupAttachment[] = JSON.parse(row.Attachments);
      const attachmentsText = attachments
        .map(attachment => {
          return `${attachment.title} attached: ${attachment.url}`;
        })
        .join("\n");
      const descriptionText = `${description}\n\nImported from Clickup: https://app.clickup.com/t/${row["Task ID"]}\n\n${commentsText}\n\n${attachmentsText}`;

      importData.issues.push({
        title: row["Task Name"],
        description: descriptionText,
        priority: mapPriority(row.Priority),
        status: mapStatus(row.Status),
        assigneeId: row.Assignees[0],
        startedAt: !!row["Start Date"] ? new Date(row["Start Date"]) : undefined,
        labels,
      });

      for (const lab of labels) {
        if (!importData.labels[lab]) {
          importData.labels[lab] = {
            name: lab,
          };
        }
      }
    }

    return importData;
  };

  // -- Private interface

  private filePath: string;
}

const mapPriority = (input: ClickupPriority): number => {
  return input !== "null" ? parseInt(input) : 0;
};

const mapStatus = (input: string): string => {
  const priorityMap: { [cuState: string]: string } = {
    // 'Normal' workflow template
    Open: "Backlog",
    "In Progress": "In Progress",
    Closed: "Done",

    // 'Kanban' workflow template
    Review: "In Review",

    // various custom statuses
    "Up Next": "Todo",
    "In Development": "In Progress",
    Implemented: "In Review",
    "Pr On Github": "In Review",
  };
  return priorityMap[input] || "Todo";
};
