export declare function runValidationHarness(): {
    total: number;
    tp: number;
    tn: number;
    fp: number;
    fn: number;
    falsePositiveRate: number;
    falseNegativeRate: number;
    precision: number;
    recall: number;
    failures: {
        id: string;
        expected: string;
        actual: string;
        reasons: string[];
    }[];
};
