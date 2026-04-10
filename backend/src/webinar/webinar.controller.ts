import { Controller, Get, Post, Body, Param, UsePipes, ValidationPipe } from '@nestjs/common';
import { WebinarService } from './webinar.service';
import { CreateWebinarDto } from './dto/create-webinar.dto';

@Controller('webinars')
export class WebinarController {
    constructor(private readonly webinarService: WebinarService) { }

    @Post()
    @UsePipes(new ValidationPipe())
    create(@Body() createWebinarDto: CreateWebinarDto) {
        return this.webinarService.create(createWebinarDto);
    }

    @Get()
    findAll() {
        return this.webinarService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.webinarService.findOne(id);
    }
}
