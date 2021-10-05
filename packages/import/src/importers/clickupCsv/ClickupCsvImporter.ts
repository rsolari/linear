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
      if (row["Folder Name"] === "hidden") {
        continue;
      }

      const tags = row.Tags.slice(1, -1).split(",");
      const labels = tags.filter(tag => !!tag);
      const description = row["Task Content"] !== "null" ? row["Task Content"] : "";

      importData.issues.push({
        title: row["Task Name"],
        description: `${description}\n\nImported from Clickup: https://app.clickup.com/t/${row["Task ID"]}`,
        priority: mapPriority(row.Priority),
        status: row.Status,
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
