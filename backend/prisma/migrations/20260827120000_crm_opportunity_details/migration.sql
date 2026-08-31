ALTER TABLE [dbo].[SalesOpportunity]
ADD [city] NVARCHAR(80) NULL,
    [industry] NVARCHAR(120) NULL,
    [contactTitle] NVARCHAR(120) NULL;

ALTER TABLE [dbo].[SalesOpportunity]
DROP CONSTRAINT [SalesOpportunity_estimatedValue_df];
