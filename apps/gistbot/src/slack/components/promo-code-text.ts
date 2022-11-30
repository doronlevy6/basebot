const endPromoCode = new Date('2022-11-29');
const currentPromoCode = 'BETA80';
const currentPromoCodeAmount = '80%';

export const PromoCodeText = (): string => {
  const now = new Date();
  if (+now > +endPromoCode) {
    return '';
  }

  return `Use the Promo Code ${currentPromoCode} to get ${currentPromoCodeAmount} off your first month!`;
};
