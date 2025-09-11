import { Controller, Inject, Logger } from '@nestjs/common';
import { ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { CloudinaryService } from './cloudinary/cloudinary.service';
import { UploadApiResponse } from 'cloudinary';
import { UploadPayload, UserUploadPayload } from '@app/common';

@Controller()
export class UploadController {
  private readonly logger = new Logger(UploadController.name);
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    @Inject('ROOM_SERVICE') private readonly roomClient: ClientProxy,
  ) {}

  @MessagePattern('upload_image') // Listen to events from Gateway
  async handleUploadRoomImage(@Payload() payload: UploadPayload) {
    const { file } = payload;

    if (!file || !file.buffer || !file.buffer.data) {
      this.logger.error(`Invalid file payload received. Aborting upload.`);
      return;
    }

    try {
      const result = await this.cloudinaryService.uploadImage(file);
      if ('secure_url' in result) {
        const uploadResult = result as UploadApiResponse;
        this.logger.log(
          `Successfully processed image, URL: ${uploadResult.secure_url}`,
        );
        return { url: uploadResult.secure_url };
      } else {
        this.logger.error(`Cloudinary upload failed `, result);
      }
    } catch (error) {
      this.logger.error(`Failed to upload image`, (error as Error).stack);
    }
  }
}
