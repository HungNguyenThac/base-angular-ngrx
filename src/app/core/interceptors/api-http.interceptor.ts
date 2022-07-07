import { Injectable } from "@angular/core";
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from "@angular/common/http";
import { catchError, Observable, of } from "rxjs";
import { Router } from "@angular/router";
import { tap } from "rxjs/operators";
import { Store } from "@ngrx/store";
import * as fromSelectors from "../store/selectors";
import * as fromActions from "../store";
import { environment } from "@environments/environment";
import { NotificationService } from "../services/notification.service";
import { MultiLanguageService } from "@app/share/translate/multiLanguageService";
import { ToastrService } from "ngx-toastr";

const RESPONSE_CODE_401_CHANGE_PASSWORD_REQUIRED = "change_password_required";

@Injectable()
export class ApiHttpInterceptor implements HttpInterceptor {
  private accessToken$: Observable<string | undefined>;
  private authorization: string | undefined = "";

  constructor(
    private router: Router,
    private store: Store<{ accessToken: string }>,
    private notificationService: NotificationService,
    private multiLanguageService: MultiLanguageService,
    private notifier: ToastrService
  ) {
    this.accessToken$ = store.select(fromSelectors.getTokenState);
    this.accessToken$.subscribe((token) => {
      this.authorization = token;
    });
  }

  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    console.log("HttpRequest", request);
    const headers = {
      Authorization: "",
    };

    if (
      (!request.url.includes("/v1/signOn") &&
        !request.url.includes("/v1/credentials/getToken")) ||
      request.url.includes("/v1/signOn/signOut")
    ) {
      headers["Authorization"] = `Bearer ${this.authorization}`;
    }
    // clone the request
    const clone = request.clone({ setHeaders: headers });
    // check domain
    if (clone.url.startsWith(environment.API_BASE_URL)) {
      return next.handle(clone).pipe(
        tap(
          (event) => {},
          (error) => {
            if (error instanceof HttpErrorResponse)
              return this._handleAuthError(error);

            this.notifier.error(
              this.multiLanguageService.instant("common.something_went_wrong")
            );

            return null;
          },
          () => {}
        )
      );
    } else {
      return next.handle(clone);
    }
  }

  private _handleAuthError(err: HttpErrorResponse): Observable<any> | null {
    this.notifier.error(err?.error?.message);
    this.notificationService.hideLoading();

    switch (err.status) {
      case 401:
        this.store.dispatch(new fromActions.Logout(null));
        return of(this.router.navigate(["auth/sign-in"]));
      default:
        catchError((err) => of(err));
        break;
    }
    return null;
  }
}
