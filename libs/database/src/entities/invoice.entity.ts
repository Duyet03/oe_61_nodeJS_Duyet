import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { Booking } from './booking.entity';
import { Promotion } from './promotion.entity';
import { InvoiceDetail } from './invoice-detail.entity';
import {
  DECIMAL_PRECISION,
  DECIMAL_SCALE,
} from '@app/common/constants/database.constants';
import { BaseEntity } from './base.entity';
import {
  PaymentMethod,
  InvoiceStatus,
} from '@app/common/constants/database.constants';

@Entity({ name: 'invoices' })
export class Invoice extends BaseEntity {
  @Column({ type: 'int', nullable: true })
  staff_id: number;

  @Column({ type: 'int', unique: true })
  booking_id: number;

  @Column({ type: 'varchar', unique: true })
  invoice_code: string;

  @Column({
    type: 'decimal',
    precision: DECIMAL_PRECISION,
    scale: DECIMAL_SCALE,
  })
  subtotal: number;

  @Column({ type: 'int', nullable: true })
  promotion_id: number;

  @Column({
    type: 'decimal',
    precision: DECIMAL_PRECISION,
    scale: DECIMAL_SCALE,
    default: 0,
  })
  discount_amount: number;

  @Column({
    type: 'decimal',
    precision: DECIMAL_PRECISION,
    scale: DECIMAL_SCALE,
    default: 0,
  })
  tax: number;

  @Column({
    type: 'decimal',
    precision: DECIMAL_PRECISION,
    scale: DECIMAL_SCALE,
  })
  total_amount: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  payment_method: PaymentMethod;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
  })
  status: InvoiceStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'datetime' })
  issued_date: Date;

  @Column({ type: 'datetime', nullable: true })
  paid_date: Date;

  @ManyToOne(() => User, (user) => user.invoices)
  @JoinColumn({ name: 'staff_id' })
  staff: User;

  @OneToOne(() => Booking, (booking) => booking.invoice)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => Promotion, (promotion) => promotion.invoices)
  @JoinColumn({ name: 'promotion_id' })
  promotion: Promotion;

  @OneToMany(() => InvoiceDetail, (detail) => detail.invoice)
  invoiceDetails: InvoiceDetail[];
}
