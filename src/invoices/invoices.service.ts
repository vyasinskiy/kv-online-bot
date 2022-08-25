import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as fs from 'fs';
import { writeFile } from 'fs/promises';
import { Model } from 'mongoose';
import { ApiService } from 'src/api/api.service';
import { AccountsService } from '../accounts/accounts.service';
import { Invoice, InvoiceDocument } from './invoice.schema';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectModel(Invoice.name)
    private invoiceModel: Model<InvoiceDocument>,
    private readonly apiService: ApiService,
    private readonly accountsService: AccountsService,
  ) {}

  async checkIsInvoiceDownloaded(appartmentId, accountId, periodCode) {
    const invoicesDirPath = this.getDirectoryForPeriod(
      appartmentId,
      periodCode,
    );
    const existedInvoices = fs.readdirSync(invoicesDirPath);
    const invoiceName = await this.constructInvoiceName(accountId, periodCode);
    return existedInvoices.includes(invoiceName);
  }

  async updateInvoicesForPeriod(appartmentId: number, periodCode: number) {
    const invoicesDirPath = this.getDirectoryForPeriod(
      appartmentId,
      periodCode,
    );
    const existedInvoices = fs.readdirSync(invoicesDirPath);

    const appartmentAccounts =
      await this.accountsService.getAccountsForAppartment(appartmentId);
    const accountsToIgnore = existedInvoices.map((invoice) =>
      this.getAccountFromInvoiceName(invoice),
    );
    const accountsToFetch = appartmentAccounts.filter(
      (account) => !accountsToIgnore.includes(account._id),
    );
    for await (const account of accountsToFetch) {
      const invoice = await this.fetchInvoiceForPeriod(account._id, periodCode);
      const invoicePath = this.constructInvoicePath(
        appartmentId,
        periodCode,
        account._id,
      );
      await this.saveInvoice(invoice, invoicePath);
      // await this.create({
      //   appartmentId,
      //   accountId: account._id,
      //   periodCode,
      //   src: invoicePath,
      // });
    }
  }

  async constructInvoicePath(apparmentId, periodCode, accountId) {
    const invoiceDir = this.getDirectoryForPeriod(apparmentId, periodCode);
    const invoiceName = await this.constructInvoiceName(accountId, periodCode);
    return `${invoiceDir}/${invoiceName}`;
  }

  private async constructInvoiceName(accountId, periodCode) {
    const organizationName =
      await this.accountsService.getOrganizationNameByAccountId(accountId);
    const { year, month } = this.getSeparatedPeriodCode(periodCode);
    return `${organizationName}_${year}-${month}_${accountId}.pdf`;
  }

  async saveInvoice(invoice, invoicePath) {
    // TODO: how to use fs.writeFileSync(invoicePath, invoice)?
    await writeFile(invoicePath, invoice);
  }

  private getAccountFromInvoiceName(fileName) {
    const splittedFileName = fileName.split('_');
    return splittedFileName[splittedFileName.length - 1];
  }

  async fetchInvoiceForPeriod(accountId, periodCode) {
    console.log(
      `Fetching invoice for account ${accountId} for period ${periodCode}...`,
    );
    const { data } = await this.apiService.getInvoice(accountId, periodCode);

    return data;
  }

  private getDirectoryForPeriod(appartmentId: number, periodCode: number) {
    const { year, month } = this.getSeparatedPeriodCode(periodCode);
    const path = `src/assets/pdf/${appartmentId}/${year}${month}`;
    const isDirExists = fs.existsSync(path);
    if (!isDirExists) {
      fs.mkdirSync(path, { recursive: true });
    }

    return path;
  }

  private getSeparatedPeriodCode(periodCode) {
    const string = String(periodCode);
    return { year: string.slice(0, 4), month: string.slice(4, 6) };
  }

  async create(dto: Invoice): Promise<any> {
    const newEntity = await new this.invoiceModel(dto);
    await newEntity.save();
  }

  // async findAll(): Promise<Appartment[]> {
  //   return this.appartmentModel.find().exec();
  // }
}