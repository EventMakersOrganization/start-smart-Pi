import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('UsersController', () => {
    let controller: UsersController;
    let service: UsersService;

    const mockUser = {
        id: 'userId123',
        email: 'test@example.com',
        role: 'student',
    };

    let mockUsersService: any;

    beforeEach(async () => {
        mockUsersService = {
            getProfile: jest.fn(),
            getUsersByRole: jest.fn(),
            updateProfile: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<UsersController>(UsersController);
        service = module.get<UsersService>(UsersService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getProfile', () => {
        it('should return profile of the authenticated user (happy path)', async () => {
            const mockProfile = { user: { email: 'test@example.com' }, profile: null };
            mockUsersService.getProfile.mockResolvedValue(mockProfile);

            const result = await controller.getProfile({ user: mockUser });

            expect(result).toEqual(mockProfile);
            expect(service.getProfile).toHaveBeenCalledWith(mockUser.id);
        });
    });

    describe('getUsers', () => {
        it('should return users by role if role is provided (happy path)', async () => {
            const mockUsersList = [{ id: 'u1', email: 'u1@test.com' }];
            mockUsersService.getUsersByRole.mockResolvedValue(mockUsersList);

            const result = await controller.getUsers({ user: mockUser }, 'instructor');

            expect(result).toEqual(mockUsersList);
            expect(service.getUsersByRole).toHaveBeenCalledWith('instructor', mockUser.id, mockUser.role);
        });

        it('should return empty array if no role provided (edge case/validation)', async () => {
            const result = await controller.getUsers({ user: mockUser }, undefined);
            expect(result).toEqual([]);
            expect(service.getUsersByRole).not.toHaveBeenCalled();
        });
    });

    describe('updateProfile', () => {
        it('should call service updateProfile (happy path)', async () => {
            const updateDto = { first_name: 'New' };
            mockUsersService.updateProfile.mockResolvedValue({ success: true });

            const result = await controller.updateProfile({ user: mockUser }, updateDto);

            expect(result).toEqual({ success: true });
            expect(service.updateProfile).toHaveBeenCalledWith(mockUser.id, updateDto);
        });
    });
});
