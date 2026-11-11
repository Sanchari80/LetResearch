import { config } from '../config.js';

function dollars(cents) {
  return Number((cents / 100).toFixed(2));
}

export function paperPricing() {
  const amountCents = Math.round(config.paperPriceUsd * 100);
  const platformFeeCents = Math.round((amountCents * config.paperPlatformFeePercent) / 100);
  return {
    currency: 'USD',
    amount: dollars(amountCents),
    platformFeePercent: config.paperPlatformFeePercent,
    platformFee: dollars(platformFeeCents),
    researcherAmount: dollars(amountCents - platformFeeCents),
    checkoutEnabled: false,
  };
}
