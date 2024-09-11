import Database from "better-sqlite3";
import Constants from "../../../src/global/Constants";
import TableController from "./AbstractTableController";
import * as MarcherLine from "@/global/classes/MarcherLine";

export default class MarcherLineTable extends TableController<
    MarcherLine.DatabaseLine,
    MarcherLine.NewLineArgs,
    MarcherLine.ModifiedLineArgs
> {
    tableName = Constants.MarcherLineTableName;

    createTable(db: Database.Database) {
        try {
            db.exec(`
                CREATE TABLE IF NOT EXISTS "${this.tableName}" (
                    "id"	            INTEGER PRIMARY KEY AUTOINCREMENT,
                    "notes"	            TEXT,
                    "start_page_id"	    INTEGER NOT NULL,
                    "end_page_id"	    INTEGER NOT NULL,
                    "x1"                REAL NOT NULL,
                    "y1"                REAL NOT NULL,
                    "x2"                REAL NOT NULL,
                    "x2"                REAL NOT NULL,
                    "group_id"	        INTEGER,
                    "created_at"	    TEXT NOT NULL,
                    "updated_at"	    TEXT NOT NULL
                );
            `);
        } catch (error) {
            console.error("Failed to create page table:", error);
        }
    }
}
