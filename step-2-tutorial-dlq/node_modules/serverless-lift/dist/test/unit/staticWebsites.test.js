var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};
var sinon = __toModule(require("sinon"));
var fs = __toModule(require("fs"));
var path = __toModule(require("path"));
var import_lodash = __toModule(require("lodash"));
var import_runServerless = __toModule(require("../utils/runServerless"));
var CloudFormationHelpers = __toModule(require("../../src/CloudFormation"));
var import_s3_sync = __toModule(require("../../src/utils/s3-sync"));
var import_mockAws = __toModule(require("../utils/mockAws"));
describe("static websites", () => {
  afterEach(() => {
    sinon.restore();
  });
  it("should create all required resources", async () => {
    const { cfTemplate, computeLogicalId } = await (0, import_runServerless.runServerless)({
      command: "package",
      config: Object.assign(import_runServerless.baseConfig, {
        constructs: {
          landing: {
            type: "static-website",
            path: "."
          }
        }
      })
    });
    const bucketLogicalId = computeLogicalId("landing", "Bucket");
    const bucketPolicyLogicalId = computeLogicalId("landing", "Bucket", "Policy");
    const originAccessIdentityLogicalId = computeLogicalId("landing", "CDN", "Origin1", "S3Origin");
    const responseFunction = computeLogicalId("landing", "ResponseFunction");
    const cfDistributionLogicalId = computeLogicalId("landing", "CDN");
    const cfOriginId = computeLogicalId("landing", "CDN", "Origin1");
    expect(Object.keys(cfTemplate.Resources)).toStrictEqual([
      "ServerlessDeploymentBucket",
      "ServerlessDeploymentBucketPolicy",
      bucketLogicalId,
      bucketPolicyLogicalId,
      responseFunction,
      originAccessIdentityLogicalId,
      cfDistributionLogicalId
    ]);
    expect(cfTemplate.Resources[bucketLogicalId]).toMatchObject({
      Type: "AWS::S3::Bucket",
      UpdateReplacePolicy: "Delete",
      DeletionPolicy: "Delete"
    });
    expect(cfTemplate.Resources[bucketPolicyLogicalId]).toMatchObject({
      Properties: {
        Bucket: {
          Ref: bucketLogicalId
        },
        PolicyDocument: {
          Statement: [
            {
              Action: "s3:GetObject",
              Effect: "Allow",
              Principal: {
                CanonicalUser: {
                  "Fn::GetAtt": [originAccessIdentityLogicalId, "S3CanonicalUserId"]
                }
              },
              Resource: { "Fn::Join": ["", [{ "Fn::GetAtt": [bucketLogicalId, "Arn"] }, "/*"]] }
            }
          ],
          Version: "2012-10-17"
        }
      }
    });
    expect(cfTemplate.Resources[originAccessIdentityLogicalId]).toMatchObject({
      Type: "AWS::CloudFront::CloudFrontOriginAccessIdentity",
      Properties: {
        CloudFrontOriginAccessIdentityConfig: {
          Comment: `Identity for ${cfOriginId}`
        }
      }
    });
    expect(cfTemplate.Resources[cfDistributionLogicalId]).toMatchObject({
      Type: "AWS::CloudFront::Distribution",
      Properties: {
        DistributionConfig: {
          CustomErrorResponses: [
            {
              ErrorCachingMinTTL: 0,
              ErrorCode: 404,
              ResponseCode: 200,
              ResponsePagePath: "/index.html"
            }
          ],
          DefaultCacheBehavior: {
            AllowedMethods: ["GET", "HEAD", "OPTIONS"],
            Compress: true,
            TargetOriginId: cfOriginId,
            ViewerProtocolPolicy: "redirect-to-https",
            FunctionAssociations: [
              {
                EventType: "viewer-response",
                FunctionARN: {
                  "Fn::GetAtt": [responseFunction, "FunctionARN"]
                }
              }
            ]
          },
          DefaultRootObject: "index.html",
          Enabled: true,
          HttpVersion: "http2",
          IPV6Enabled: true,
          Origins: [
            {
              DomainName: {
                "Fn::GetAtt": [bucketLogicalId, "RegionalDomainName"]
              },
              Id: cfOriginId,
              S3OriginConfig: {
                OriginAccessIdentity: {
                  "Fn::Join": [
                    "",
                    [
                      "origin-access-identity/cloudfront/",
                      {
                        Ref: originAccessIdentityLogicalId
                      }
                    ]
                  ]
                }
              }
            }
          ]
        }
      }
    });
    expect(cfTemplate.Outputs).toMatchObject({
      [computeLogicalId("landing", "BucketName")]: {
        Description: "Name of the bucket that stores the static website.",
        Value: {
          Ref: bucketLogicalId
        }
      },
      [computeLogicalId("landing", "Domain")]: {
        Description: "Website domain name.",
        Value: {
          "Fn::GetAtt": [cfDistributionLogicalId, "DomainName"]
        }
      },
      [computeLogicalId("landing", "CloudFrontCName")]: {
        Description: "CloudFront CNAME.",
        Value: {
          "Fn::GetAtt": [cfDistributionLogicalId, "DomainName"]
        }
      },
      [computeLogicalId("landing", "DistributionId")]: {
        Description: "ID of the CloudFront distribution.",
        Value: {
          Ref: cfDistributionLogicalId
        }
      }
    });
    expect(cfTemplate.Resources[responseFunction]).toMatchObject({
      Type: "AWS::CloudFront::Function",
      Properties: {
        AutoPublish: true,
        FunctionConfig: {
          Comment: "app-dev-us-east-1-landing-response",
          Runtime: "cloudfront-js-1.0"
        },
        Name: "app-dev-us-east-1-landing-response"
      }
    });
  });
  it("should support a custom domain", async () => {
    const { cfTemplate, computeLogicalId } = await (0, import_runServerless.runServerless)({
      command: "package",
      config: Object.assign(import_runServerless.baseConfig, {
        constructs: {
          landing: {
            type: "static-website",
            path: ".",
            domain: "example.com",
            certificate: "arn:aws:acm:us-east-1:123456615250:certificate/0a28e63d-d3a9-4578-9f8b-14347bfe8123"
          }
        }
      })
    });
    const cfDistributionLogicalId = computeLogicalId("landing", "CDN");
    expect(cfTemplate.Resources[cfDistributionLogicalId]).toMatchObject({
      Type: "AWS::CloudFront::Distribution",
      Properties: {
        DistributionConfig: {
          Aliases: ["example.com"],
          ViewerCertificate: {
            AcmCertificateArn: "arn:aws:acm:us-east-1:123456615250:certificate/0a28e63d-d3a9-4578-9f8b-14347bfe8123",
            MinimumProtocolVersion: "TLSv1.2_2021",
            SslSupportMethod: "sni-only"
          }
        }
      }
    });
    expect(cfTemplate.Outputs).toMatchObject({
      [computeLogicalId("landing", "Domain")]: {
        Description: "Website domain name.",
        Value: "example.com"
      },
      [computeLogicalId("landing", "CloudFrontCName")]: {
        Description: "CloudFront CNAME.",
        Value: {
          "Fn::GetAtt": [cfDistributionLogicalId, "DomainName"]
        }
      }
    });
  });
  it("should support multiple custom domains", async () => {
    const { cfTemplate, computeLogicalId } = await (0, import_runServerless.runServerless)({
      command: "package",
      config: Object.assign(import_runServerless.baseConfig, {
        constructs: {
          landing: {
            type: "static-website",
            path: ".",
            domain: ["example.com", "www.example.com"],
            certificate: "arn:aws:acm:us-east-1:123456615250:certificate/0a28e63d-d3a9-4578-9f8b-14347bfe8123"
          }
        }
      })
    });
    const cfDistributionLogicalId = computeLogicalId("landing", "CDN");
    expect(cfTemplate.Resources[cfDistributionLogicalId]).toMatchObject({
      Type: "AWS::CloudFront::Distribution",
      Properties: {
        DistributionConfig: {
          Aliases: ["example.com", "www.example.com"]
        }
      }
    });
    expect(cfTemplate.Outputs).toMatchObject({
      [computeLogicalId("landing", "Domain")]: {
        Description: "Website domain name.",
        Value: "example.com"
      },
      [computeLogicalId("landing", "CloudFrontCName")]: {
        Description: "CloudFront CNAME.",
        Value: {
          "Fn::GetAtt": [cfDistributionLogicalId, "DomainName"]
        }
      }
    });
  });
  it("should allow to customize security HTTP headers", async () => {
    const { cfTemplate, computeLogicalId } = await (0, import_runServerless.runServerless)({
      command: "package",
      config: Object.assign(import_runServerless.baseConfig, {
        constructs: {
          landing: {
            type: "static-website",
            path: ".",
            security: {
              allowIframe: true
            }
          }
        }
      })
    });
    const edgeFunction = computeLogicalId("landing", "ResponseFunction");
    expect(cfTemplate.Resources[edgeFunction]).toMatchObject({
      Type: "AWS::CloudFront::Function",
      Properties: {
        FunctionCode: `function handler(event) {
    var response = event.response;
    response.headers = Object.assign({}, {
    "x-content-type-options": {
        "value": "nosniff"
    },
    "x-xss-protection": {
        "value": "1; mode=block"
    },
    "strict-transport-security": {
        "value": "max-age=63072000"
    }
}, response.headers);
    return response;
}`
      }
    });
  });
  it("should allow to redirect to the main domain", async () => {
    const { cfTemplate, computeLogicalId } = await (0, import_runServerless.runServerless)({
      command: "package",
      config: Object.assign(import_runServerless.baseConfig, {
        constructs: {
          landing: {
            type: "static-website",
            path: ".",
            domain: ["www.example.com", "example.com"],
            certificate: "arn:aws:acm:us-east-1:123456615250:certificate/0a28e63d-d3a9-4578-9f8b-14347bfe8123",
            redirectToMainDomain: true
          }
        }
      })
    });
    const cfDistributionLogicalId = computeLogicalId("landing", "CDN");
    const requestFunction = computeLogicalId("landing", "RequestFunction");
    const responseFunction = computeLogicalId("landing", "ResponseFunction");
    expect(cfTemplate.Resources[requestFunction]).toMatchInlineSnapshot(`
            Object {
              "Properties": Object {
                "AutoPublish": true,
                "FunctionCode": "function handler(event) {
                var request = event.request;
                if (request.headers[\\"host\\"].value !== \\"www.example.com\\") {
                    return {
                        statusCode: 301,
                        statusDescription: \\"Moved Permanently\\",
                        headers: {
                            location: {
                                value: \\"https://www.example.com\\" + request.uri
                            }
                        }
                    };
                }
                return request;
            }",
                "FunctionConfig": Object {
                  "Comment": "app-dev-us-east-1-landing-request",
                  "Runtime": "cloudfront-js-1.0",
                },
                "Name": "app-dev-us-east-1-landing-request",
              },
              "Type": "AWS::CloudFront::Function",
            }
        `);
    expect((0, import_lodash.get)(cfTemplate.Resources[cfDistributionLogicalId], "Properties.DistributionConfig.DefaultCacheBehavior.FunctionAssociations")).toMatchInlineSnapshot(`
        Array [
          Object {
            "EventType": "viewer-response",
            "FunctionARN": Object {
              "Fn::GetAtt": Array [
                "${responseFunction}",
                "FunctionARN",
              ],
            },
          },
          Object {
            "EventType": "viewer-request",
            "FunctionARN": Object {
              "Fn::GetAtt": Array [
                "${requestFunction}",
                "FunctionARN",
              ],
            },
          },
        ]
    `);
  });
  it("should allow to customize the error page", async () => {
    const { cfTemplate, computeLogicalId } = await (0, import_runServerless.runServerless)({
      command: "package",
      config: Object.assign(import_runServerless.baseConfig, {
        constructs: {
          landing: {
            type: "static-website",
            path: ".",
            errorPage: "my/custom/error.html"
          }
        }
      })
    });
    const cfDistributionLogicalId = computeLogicalId("landing", "CDN");
    expect(cfTemplate.Resources[cfDistributionLogicalId]).toMatchObject({
      Properties: {
        DistributionConfig: {
          CustomErrorResponses: [
            {
              ErrorCachingMinTTL: 0,
              ErrorCode: 404,
              ResponseCode: 404,
              ResponsePagePath: "/my/custom/error.html"
            }
          ]
        }
      }
    });
  });
  it("should validate the error page path", async () => {
    await expect(() => {
      return (0, import_runServerless.runServerless)({
        command: "package",
        config: Object.assign(import_runServerless.baseConfig, {
          constructs: {
            landing: {
              type: "static-website",
              path: ".",
              errorPage: "./error.html"
            }
          }
        })
      });
    }).rejects.toThrowError("The 'errorPage' option of the 'landing' static website cannot start with './' or '../'. (it cannot be a relative path).");
    await expect(() => {
      return (0, import_runServerless.runServerless)({
        command: "package",
        config: Object.assign(import_runServerless.baseConfig, {
          constructs: {
            landing: {
              type: "static-website",
              path: ".",
              errorPage: "../error.html"
            }
          }
        })
      });
    }).rejects.toThrowError("The 'errorPage' option of the 'landing' static website cannot start with './' or '../'. (it cannot be a relative path).");
  });
  it("should synchronize files to S3", async () => {
    const awsMock = (0, import_mockAws.mockAws)();
    sinon.stub(CloudFormationHelpers, "getStackOutput").resolves("bucket-name");
    awsMock.mockService("S3", "listObjectsV2").resolves({
      IsTruncated: false,
      Contents: [
        {
          Key: "index.html",
          ETag: (0, import_s3_sync.computeS3ETag)(fs.readFileSync(path.join(__dirname, "../fixtures/staticWebsites/public/index.html")))
        },
        { Key: "styles.css" },
        { Key: "image.jpg" }
      ]
    });
    const putObjectSpy = awsMock.mockService("S3", "putObject");
    const deleteObjectsSpy = awsMock.mockService("S3", "deleteObjects").resolves({
      Deleted: [
        {
          Key: "image.jpg"
        }
      ]
    });
    const cloudfrontInvalidationSpy = awsMock.mockService("CloudFront", "createInvalidation");
    await (0, import_runServerless.runServerless)({
      fixture: "staticWebsites",
      configExt: import_runServerless.pluginConfigExt,
      command: "landing:upload"
    });
    sinon.assert.callCount(putObjectSpy, 2);
    expect(putObjectSpy.firstCall.firstArg).toEqual({
      Bucket: "bucket-name",
      Key: "scripts.js",
      Body: fs.readFileSync(path.join(__dirname, "../fixtures/staticWebsites/public/scripts.js")),
      ContentType: "application/javascript"
    });
    expect(putObjectSpy.secondCall.firstArg).toEqual({
      Bucket: "bucket-name",
      Key: "styles.css",
      Body: fs.readFileSync(path.join(__dirname, "../fixtures/staticWebsites/public/styles.css")),
      ContentType: "text/css"
    });
    sinon.assert.calledOnce(deleteObjectsSpy);
    expect(deleteObjectsSpy.firstCall.firstArg).toEqual({
      Bucket: "bucket-name",
      Delete: {
        Objects: [
          {
            Key: "image.jpg"
          }
        ]
      }
    });
    sinon.assert.calledOnce(cloudfrontInvalidationSpy);
  });
});
//# sourceMappingURL=staticWebsites.test.js.map
