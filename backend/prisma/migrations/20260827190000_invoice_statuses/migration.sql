ALTER TABLE [dbo].[Invoice] DROP CONSTRAINT [Invoice_status_ck];

ALTER TABLE [dbo].[Invoice] WITH CHECK ADD CONSTRAINT [Invoice_status_ck]
CHECK (
  [status] IN (
    'DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_CREDITED',
    'CREDITED', 'SETTLED', 'CANCELLED', 'OVERDUE'
  )
  AND [subtotal] >= 0
  AND [taxAmount] >= 0
  AND [totalAmount] >= 0
  AND [paidAmount] >= 0
  AND [creditedAmount] >= 0
);
