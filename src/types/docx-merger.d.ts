declare module 'docx-merger' {
  type SaveType = 'nodebuffer' | 'blob' | 'base64';

  interface DocxMergerOptions {
    pageBreaks?: boolean;
    // The library accepts an empty options object as well
    [key: string]: any;
  }

  class DocxMerger {
    constructor(options: DocxMergerOptions | {}, files: any[]);
    save(type: SaveType, callback: (data: any) => void): void;
  }

  export default DocxMerger;
}
