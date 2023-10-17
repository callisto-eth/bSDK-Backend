import { Body, Controller, Patch, Post } from '@nestjs/common';
import { EthereumService, BitcoinService } from './app.service';
import { PrismaService } from './prisma.service';
import { Invoice } from '@prisma/client';
import CryptoConvert from 'crypto-convert';

type MessageDTO = {
  totalAmount: number;
  paymentMethod: string;
  productData: {
    Name: string;
    Description: string;
    Url: string;
  }[];
};

type CheckStatusDTO = {
  InvoiceID: string;
  Method: string;
  TemporaryAddress: `0x${string}`;
};

type UpdateDTO = {
  InvoiceID: string;
  Method: string;
  TemporaryAddress: `0x${string}`;
};

@Controller()
export class AppController {
  constructor(
    private ethereumService: EthereumService,
    private bitcoinService: BitcoinService,
    private prisma: PrismaService,
  ) {}

  @Post('/api/checkstatus')
  async checkStatus(@Body() messageBody: CheckStatusDTO) {
    var walletBalance: bigint;

    switch (messageBody.Method) {
      case 'ETH':
        walletBalance = await this.ethereumService.checkWalletBalance(
          messageBody.TemporaryAddress,
        );
        break;
      case 'BTC':
        '';
        break;
      case 'DOGE':
        '';
        break;
      default:
        throw new Error('Method not Found');
    }

    const findInvoice = await this.prisma.invoice.findUnique({
      where: {
        ID: messageBody.InvoiceID,
      },
    });

    if (findInvoice.CoinAmount === walletBalance) {
      await this.prisma.invoice.update({
        where: {
          ID: messageBody.InvoiceID,
        },
        data: {
          Paid: true,
        },
      });

      return {
        statusCode: 200,
        paymentStatus: 'Paid',
      };
    } else {
      return {
        statusCode: 420,
        paymentStatus: 'Not Paid',
      };
    }
  }

  @Post('/api/invoice/create')
  async postInvoice(@Body() messageBody: MessageDTO): Promise<Invoice> {
    const convert = new CryptoConvert({});
    await convert.ready();
    const createdInvoice = await this.prisma.invoice.create({
      data: {
        Amount: messageBody.totalAmount.toString(),
        Paid: false,
        Method: 'ETH',
        Expiry: (Date.now() + 5400).toString(),
        mnemonicStr: this.ethereumService.generateMnemonicPhrase(),
        CoinAmount: convert.ETH.USD(messageBody.totalAmount) || 0,
      },
    });

    return createdInvoice;
  }

  @Patch('/api/invoice/update')
  async updateInvoice(@Body() messageBody: UpdateDTO): Promise<Invoice> {
    const convert = new CryptoConvert({});
    await convert.ready();

    const findInvoice = await this.prisma.invoice.findUnique({
      where: {
        ID: messageBody.InvoiceID,
      },
    });

    const updatedInvoice = await this.prisma.invoice.update({
      where: {
        ID: messageBody.InvoiceID,
      },
      data: {
        Method: messageBody.Method,
        CoinAmount: eval(
          `convert.${messageBody.Method}.USD(${findInvoice.Amount})`,
        ),
      },
    });

    return updatedInvoice;
  }
}