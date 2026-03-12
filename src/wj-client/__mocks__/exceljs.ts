// Manual mock for ExcelJS to avoid Node.js dependency issues in Jest
export class Workbook {
  worksheets: Worksheet[] = [];
  private _worksheetId = 1;

  xlsx = {
    writeBuffer: jest.fn().mockResolvedValue(Buffer.from('mock excel data')),
  };

  addWorksheet(name?: string): Worksheet {
    const worksheet = new Worksheet(name, this._worksheetId++);
    this.worksheets.push(worksheet);
    return worksheet;
  }

  getWorksheet(indexOrName?: number | string): Worksheet | undefined {
    if (typeof indexOrName === 'number') {
      return this.worksheets[indexOrName - 1];
    }
    return this.worksheets.find(ws => ws.name === indexOrName);
  }

  eachSheet(callback: (worksheet: Worksheet, id: number) => void): void {
    this.worksheets.forEach((ws, index) => callback(ws, index + 1));
  }
}

export class Worksheet {
  name: string;
  id: number;
  columns: Column[] = [];
  rows: Map<number, Row> = new Map();

  constructor(name?: string, id?: number) {
    this.name = name || 'Sheet1';
    this.id = id || 1;
  }

  get rowCount(): number {
    return this.rows.size;
  }

  addRow(values?: any): Row {
    const rowNumber = this.rows.size + 1;
    const row = new Row(rowNumber, values);
    this.rows.set(rowNumber, row);
    return row;
  }

  getRow(rowNumber: number): Row {
    if (!this.rows.has(rowNumber)) {
      this.rows.set(rowNumber, new Row(rowNumber));
    }
    return this.rows.get(rowNumber)!;
  }

  eachRow(callback: (row: Row, rowNumber: number) => void): void {
    this.rows.forEach((row, rowNumber) => callback(row, rowNumber));
  }

  getCell(address: string): Cell {
    const colLetter = address.charAt(0);
    const rowNum = parseInt(address.slice(1));
    const row = this.getRow(rowNum);
    return row.getCell(colLetter);
  }

  views: any[] = [];
  autoFilter: any = {};
}

export class Row {
  number: number;
  values: any[] = [];
  font?: any;
  fill?: any;
  alignment?: any;
  height?: number;
  private _cells: Map<string, Cell> = new Map();

  constructor(number: number, values?: any) {
    this.number = number;
    if (values) {
      if (typeof values === 'object') {
        // Object with column keys
        Object.assign(this.values, values);
      } else {
        // Array of values
        this.values = values;
      }
    }
  }

  getCell(colLetter: string): Cell {
    const key = `${this.number}-${colLetter}`;
    if (!this._cells.has(key)) {
      this._cells.set(key, new Cell());
    }
    return this._cells.get(key)!;
  }

  eachCell(callback: (cell: Cell, colNumber: number) => void): void {
    // Iterate through column keys and call callback for each cell
    const keys = Object.keys(this.values);
    keys.forEach((key, index) => {
      const cell = this.getCell(key);
      callback(cell, index + 1);
    });
  }
}

export class Cell {
  value?: any;
  font?: any;
  fill?: any;
  alignment?: any;
}

export class Column {
  header?: string;
  key?: string;
  width?: number;
}

export const ExcelJS = {
  Workbook,
};
