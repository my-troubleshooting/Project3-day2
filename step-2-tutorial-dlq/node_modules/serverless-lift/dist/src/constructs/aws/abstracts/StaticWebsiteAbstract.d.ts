import { Distribution } from "aws-cdk-lib/aws-cloudfront";
import type { Construct as CdkConstruct } from "constructs";
import type { ConstructCommands } from "@lift/constructs";
import { AwsConstruct } from "@lift/constructs/abstracts";
import type { AwsProvider } from "@lift/providers";
import type { FromSchema } from "json-schema-to-ts";
export declare const COMMON_STATIC_WEBSITE_DEFINITION: {
    readonly type: "object";
    readonly properties: {
        readonly path: {
            readonly type: "string";
        };
        readonly domain: {
            readonly anyOf: readonly [{
                readonly type: "string";
            }, {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
            }];
        };
        readonly certificate: {
            readonly type: "string";
        };
        readonly security: {
            readonly type: "object";
            readonly properties: {
                readonly allowIframe: {
                    readonly type: "boolean";
                };
            };
            readonly additionalProperties: false;
        };
        readonly errorPage: {
            readonly type: "string";
        };
        readonly redirectToMainDomain: {
            readonly type: "boolean";
        };
    };
    readonly additionalProperties: false;
    readonly required: readonly ["path"];
};
export declare type CommonStaticWebsiteConfiguration = FromSchema<typeof COMMON_STATIC_WEBSITE_DEFINITION>;
export declare abstract class StaticWebsiteAbstract extends AwsConstruct {
    protected readonly id: string;
    protected readonly configuration: CommonStaticWebsiteConfiguration;
    protected readonly provider: AwsProvider;
    static commands: ConstructCommands;
    protected readonly distribution: Distribution;
    protected readonly domains: string[] | undefined;
    private readonly bucketNameOutput;
    private readonly domainOutput;
    private readonly cnameOutput;
    private readonly distributionIdOutput;
    constructor(scope: CdkConstruct, id: string, configuration: CommonStaticWebsiteConfiguration, provider: AwsProvider);
    variables(): Record<string, unknown>;
    outputs(): Record<string, () => Promise<string | undefined>>;
    postDeploy(): Promise<void>;
    uploadWebsiteCommand(): Promise<void>;
    private uploadWebsite;
    private clearCDNCache;
    preRemove(): Promise<void>;
    getUrl(): Promise<string | undefined>;
    getBucketName(): Promise<string | undefined>;
    getDomain(): Promise<string | undefined>;
    getCName(): Promise<string | undefined>;
    getDistributionId(): Promise<string | undefined>;
    private errorResponse;
    private createResponseFunction;
}
