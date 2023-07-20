import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as resourceGroup from 'aws-cdk-lib/aws-resourcegroups'
import * as efs from 'aws-cdk-lib/aws-efs';
import { Construct } from 'constructs';

export class WordpressCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stackname = cdk.Stack.of(this).stackName;

    new resourceGroup.CfnGroup(this, `${stackname}-resource-group`, {
      name: 'wordpress',
      resourceQuery: {
        type: 'CLOUDFORMATION_STACK_1_0',
      },
    });

    const vpc = new ec2.Vpc(this, `${stackname}-vpc`, {
      maxAzs: 2,
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      subnetConfiguration: [
        {
          name: 'public-',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'app-',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'data-',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
      natGateways: 1,
    });

    // const fileSystem = new efs.FileSystem(this, `${stackname}-fs`, {
    //   vpc: vpc,
    //   fileSystemName: 'wordpress-filesystem',
    //   vpcSubnets: vpc.selectSubnets({
    //     subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    //   }),
    //   encrypted: true,
    // });

    const cluster = new ecs.Cluster(this, `${stackname}-cluster`, {
      vpc: vpc,
      clusterName: 'wordpress-cluster',
      containerInsights: true,
      capacity: {
        instanceType: new ec2.InstanceType('t3.micro'),
        desiredCapacity: 1,
        vpcSubnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }),
      },
    });

    const taskDefinition = new ecs.TaskDefinition(this, `${stackname}-task-def`, {
      networkMode: ecs.NetworkMode.AWS_VPC,
      compatibility: ecs.Compatibility.EC2,
    });

    // taskDefinition.addVolume({
    //   name: 'wordpress-efs',
    //   efsVolumeConfiguration: {
    //     fileSystemId: fileSystem.fileSystemId,
    //     transitEncryption: 'ENABLED',
    //     rootDirectory: '/',
    //   },
    // });

    const container = taskDefinition.addContainer(`${stackname}-container`, {
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/bitnami/nginx:latest'), // 'public.ecr.aws/bitnami/wordpress:latest'
      memoryLimitMiB: 512,
      cpu: 1,
      environmentFiles: [],
      containerName: 'wordpress-container',
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'wordpress',
      }),
    });

    // container.addMountPoints({
    //   containerPath: '/', // '/var/www/html',
    //   sourceVolume: 'wordpress-efs',
    //   readOnly: false,
    // });

    const service = new ecs.Ec2Service(this, `${stackname}-service`, {
      cluster: cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1,
      serviceName: 'wordpress-service',
    });
  }
}
