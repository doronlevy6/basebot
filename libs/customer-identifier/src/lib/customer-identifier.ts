import { EmailSender } from '@base/emailer';
import { Stripe } from 'stripe';
import { CustomerStore } from './customer-store';
import { CustomerIdentifierLock } from './lock';
import { generatePassphrase } from './passphrase';

export class CustomerIdentifier {
  constructor(
    private customerStore: CustomerStore,
    private lock: CustomerIdentifierLock,
    private emailSender: EmailSender,
  ) {}

  async identifyCustomer(customer: Stripe.Customer) {
    let succeeded = false;
    let tries = 0;

    // In order to ensure passphrase uniqueness (so that we don't connect users incorrectly), we do this in a loop.
    // Since the passphrase implementation is supposed to be cryptographically secure and random this should
    // never happen... but as always, safety first. As you know, I'm a sucker for safety.
    while (!succeeded) {
      if (tries > 10) {
        throw new Error(
          'somehow the generated passphrase was not unique 10 times!',
        );
      }
      const generatedPassphrase = generatePassphrase();
      succeeded = await this.customerStore.addCustomer(
        customer.id,
        generatedPassphrase,
      );
      tries++;
    }
    const customerInfo = await this.customerStore.getCustomerInfo(customer.id);

    // If we already have both of them filled out, then we just return
    // since there is no need to run any sort of identification function.
    if (customerInfo.slackTeamId && customerInfo.slackUserId) {
      return;
    }

    // We are requiring emails on the Stripe payments page, so this should never happen,
    // but we add it for safety just in case.
    if (!customer.email) {
      throw new Error(
        'Stripe customer object has no email attached (email must be required)',
      );
    }

    // Since this is going to be triggered by Stripe's events, we
    // should make sure that it is only running in one process concurrently.
    // I'm not sure if Stripe might accidentally send the event multiple times,
    // or if maybe we will timeout on something, so this is just for safety reasons.
    const acquireLock = await this.lock.lock(customer.id);
    if (!acquireLock) {
      return;
    }

    await this.emailSender.sendEmail({
      fromName: 'theGist.AI',
      to: customer.email,
      subject: 'Activate Your Subscription to theGist',
      text:
        `Thanks for subscribing to theGist!\n\n` +
        `Copy the following passphrase and send it to the bot as a message, ` +
        `and it will activate your subscription:\n\nMy Passphrase Is: ${customerInfo.passphrase}`,
    });
  }

  async matchUserToCustomer(
    passphrase: string,
    slackUserId: string,
    slackTeamId: string,
  ): Promise<'success' | 'no_match' | 'team_mismatch' | 'user_mismatch'> {
    const customer = await this.customerStore.getCustomerByPassphrase(
      passphrase,
    );
    if (!customer) {
      return 'no_match';
    }

    if (customer.slackTeamId && customer.slackTeamId !== slackTeamId) {
      return 'team_mismatch';
    }

    if (customer.slackUserId && customer.slackUserId !== slackUserId) {
      return 'user_mismatch';
    }

    await this.customerStore.setCustomerInfo(
      customer.customerId,
      slackTeamId,
      slackUserId,
    );
    return 'success';
  }
}
