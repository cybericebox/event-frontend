interface IBaseResponse {
    Status: {
        Code: number;
        Message: string;
        Details?: any[string];
    };
}

interface IResponseWithData<D> extends IBaseResponse {
    Data: D;
    backUpData?: D;
}

export type IResponse<D = void> = D extends void ? IBaseResponse : IResponseWithData<D>;

export interface IErrorResponse extends Error {
    response: {
        data: IBaseResponse;
    };
}